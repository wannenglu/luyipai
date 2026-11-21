const { copyText, debounce } = require("../../utils/tool");
const app = getApp();

// 流量主激励视频广告位 ID，替换成你自己的
const AD_UNIT_ID = "adunit-4130215d8c8d4222";
// 每个版本解锁一次，按“版本ID + 日期”缓存，隔天需重新观看
const UNLOCK_STORAGE_KEY = "unlocked_versions";
// 每天免费获取次数，用完后再看激励视频
const FREE_TIMES_PER_DAY = 3;
const FREE_STORAGE_KEY = "daily_free_usage";

Page({
  data: {
    keyword: "",
    versionList: [],
    showQrcode: false,
    showAdminPwdModal: false,
    page: 1,
    pageSize: 10,
    noMore: false,
    isRequesting: false,
    freeTimes: FREE_TIMES_PER_DAY,
    freeLeft: FREE_TIMES_PER_DAY,
    latestId: "",
    unlocked: {},
  },
  onLoad() {
    this.videoAd = null;
    this.pendingLink = "";
    this.pendingId = "";
    this.isShowingAd = false;
    this.isClaiming = false;
    this.initVideoAd();
    this.refreshFreeLeft();
    this.syncQuotaFromCloud();
    this.loadVersionList(false);
  },
  onShow() {
    this.refreshFreeLeft();
  },
  onReachBottom() {
    if (this.data.noMore || this.data.isRequesting) return;
    this.loadVersionList(true);
  },

  // 初始化并预加载激励视频广告
  initVideoAd() {
    if (!wx.createRewardedVideoAd) {
      console.warn("当前基础库不支持激励视频广告，走兜底逻辑");
      return;
    }
    if (!AD_UNIT_ID || AD_UNIT_ID.indexOf("xxxx") !== -1) {
      console.warn("请先配置激励视频广告位 ID，当前走兜底逻辑");
      return;
    }
    const videoAd = wx.createRewardedVideoAd({ adUnitId: AD_UNIT_ID });
    videoAd.onError((err) => {
      console.error("激励视频广告错误", err);
    });
    videoAd.onClose((res) => {
      this.isShowingAd = false;
      // res.isEnded 为 true 表示完整看完广告
      if (res && res.isEnded) {
        this.rewardSuccess();
      } else {
        this.pendingLink = "";
        this.pendingId = "";
        wx.showToast({ title: "完整观看广告才能获取链接", icon: "none" });
        videoAd.load().catch(() => {});
      }
    });
    this.videoAd = videoAd;
    videoAd.load().catch(() => {});
  },

  // 点击获取链接：优先使用云端每日配额，换设备/清缓存也不会重置
  async getLink(e) {
    const { link, id } = e.currentTarget.dataset;
    if (!link) return;
    if (this.isShowingAd) return;
    // 防止连续点击重复扣次数
    if (this.isClaiming) return;
    this.isClaiming = true;
    // 本地已解锁该版本（当天），直接复制
    if (this.isUnlocked(id)) {
      this.isClaiming = false;
      this.copyLinkAndTip(link);
      return;
    }
    wx.showLoading({ title: "正在获取", mask: true });
    let result = null;
    try {
      const res = await wx.cloud.callFunction({
        name: "versionQuota",
        data: { action: "claim", id, allowFree: id !== this.latestId },
      });
      result = res.result;
    } catch (err) {
      console.error("配额校验失败", err);
    } finally {
      this.isClaiming = false;
      wx.hideLoading();
    }
    // 云端不可用时走本地逻辑兜底
    if (!result) {
      this.localClaim(link, id);
      return;
    }
    this.applyQuota(result);
    if (result.ok) {
      this.markUnlocked(id);
      this.copyLinkAndTip(
        link,
        result.freeLeft > 0
          ? `链接已复制，今日还可免费获取 ${result.freeLeft} 次`
          : "链接已复制，请到浏览器打开",
      );
      return;
    }
    // 免费次数用完，需要看广告
    if (!this.videoAd) {
      this.copyLinkAndTip(link, "广告暂不可用，已直接为你获取链接");
      this.reportUnlock(id);
      return;
    }
    this.pendingLink = link;
    this.pendingId = id;
    this.showRewardedAd();
  },

  // 云端不可用时的本地兜底
  localClaim(link, id) {
    const needAdFirst = id && id === this.latestId;
    if (!needAdFirst && this.getFreeLeft() > 0) {
      this.consumeFree();
      this.markUnlocked(id);
      this.copyLinkAndTip(
        link,
        `链接已复制，今日还可免费获取 ${this.getFreeLeft()} 次`,
      );
      return;
    }
    if (!this.videoAd) {
      this.copyLinkAndTip(link, "广告暂不可用，已直接为你获取链接");
      this.reportUnlock(id);
      return;
    }
    this.pendingLink = link;
    this.pendingId = id;
    this.showRewardedAd();
  },

  // 把云端返回的免费次数同步到本地
  applyQuota(result) {
    if (!result || typeof result.freeLeft !== "number") return;
    this.setData({ freeLeft: result.freeLeft });
    wx.setStorageSync(FREE_STORAGE_KEY, {
      date: this.getTodayKey(),
      used: FREE_TIMES_PER_DAY - result.freeLeft,
    });
  },

  // 进入小程序时同步云端的免费次数与已解锁版本
  async syncQuotaFromCloud() {
    try {
      const res = await wx.cloud.callFunction({
        name: "versionQuota",
        data: { action: "query" },
      });
      const result = res.result;
      if (!result) return;
      const today = this.getTodayKey();
      // 云端为准：覆盖本地缓存，云端清空后本地状态随之清空
      const cache = {};
      const unlocked = {};
      (result.unlocked || []).forEach((id) => {
        cache[id] = today;
        unlocked[id] = true;
      });
      wx.setStorageSync(UNLOCK_STORAGE_KEY, cache);
      this.setData({ unlocked });
      this.applyQuota(result);
    } catch (err) {
      console.error("配额同步失败", err);
    }
  },

  // 记录当天已解锁到云端（看完广告或广告不可用兜底）
  async reportUnlock(id) {
    this.markUnlocked(id);
    if (!id) return;
    try {
      await wx.cloud.callFunction({
        name: "versionQuota",
        data: { action: "ad", id },
      });
    } catch (err) {
      console.error("解锁同步失败", err);
    }
  },

  showRewardedAd() {
    const videoAd = this.videoAd;
    this.isShowingAd = true;
    videoAd.show().catch(() => {
      // 首次展示失败，重新加载后再试一次
      return videoAd
        .load()
        .then(() => videoAd.show())
        .catch(() => {
          // 仍然失败，走兜底，直接提供链接
          this.isShowingAd = false;
          this.giveUpAd();
        });
    });
  },

  // 广告无法获取时的兜底
  giveUpAd() {
    const link = this.pendingLink;
    const id = this.pendingId;
    this.pendingLink = "";
    this.pendingId = "";
    if (!link) return;
    this.copyLinkAndTip(link, "广告暂时无法加载，已直接为你获取链接");
    this.reportUnlock(id);
  },

  // 完整看完广告
  rewardSuccess() {
    const link = this.pendingLink;
    const id = this.pendingId;
    this.pendingLink = "";
    this.pendingId = "";
    if (!link) return;
    this.reportUnlock(id);
    this.copyLinkAndTip(link);
    if (this.videoAd) this.videoAd.load().catch(() => {});
  },

  getTodayKey() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  },

  // 读取当天免费使用记录，跨天自动重置
  getFreeState() {
    const today = this.getTodayKey();
    const cache = wx.getStorageSync(FREE_STORAGE_KEY) || {};
    if (cache.date !== today) return { date: today, used: 0 };
    return { date: today, used: cache.used || 0 };
  },

  getFreeLeft() {
    return Math.max(0, FREE_TIMES_PER_DAY - this.getFreeState().used);
  },

  refreshFreeLeft() {
    this.setData({ freeLeft: this.getFreeLeft() });
  },

  consumeFree() {
    const state = this.getFreeState();
    state.used += 1;
    wx.setStorageSync(FREE_STORAGE_KEY, state);
    this.refreshFreeLeft();
  },

  isUnlocked(id) {
    if (!id) return false;
    const cache = wx.getStorageSync(UNLOCK_STORAGE_KEY) || {};
    return cache[id] === this.getTodayKey();
  },

  markUnlocked(id) {
    if (!id) return;
    const cache = wx.getStorageSync(UNLOCK_STORAGE_KEY) || {};
    cache[id] = this.getTodayKey();
    wx.setStorageSync(UNLOCK_STORAGE_KEY, cache);
    // 同步更新按钮状态：当天已获取过的版本按钮变为“获取链接”
    this.setData({ unlocked: { ...this.data.unlocked, [id]: true } });
  },

  // 根据当天解锁记录生成按钮状态表
  getUnlockedMap(list) {
    const today = this.getTodayKey();
    const cache = wx.getStorageSync(UNLOCK_STORAGE_KEY) || {};
    const map = {};
    (list || []).forEach((item) => {
      if (item._id && cache[item._id] === today) map[item._id] = true;
    });
    return map;
  },

  async copyLinkAndTip(link, tip) {
    const success = await copyText(link);
    if (!success) {
      wx.showToast({ title: "复制失败，请重试", icon: "none" });
      return;
    }
    wx.showToast({
      title: tip || "链接已复制，请到浏览器打开",
      icon: "none",
      duration: 2000,
    });
  },

  async loadVersionList(isLoadMore = false) {
    if (this.data.isRequesting) return;
    this.setData({ isRequesting: true });
    wx.showLoading({ title: isLoadMore ? "加载更多" : "加载中" });
    try {
      const { pageSize, keyword } = this.data;
      // 加载更多才递增页码，刷新/搜索始终请求第 1 页
      const page = isLoadMore ? this.data.page + 1 : 1;
      const res = await wx.cloud.callFunction({
        name: "getVersionList",
        data: { page, pageSize, keyword },
      });
      const rawList = res.result.data || [];
      const list = rawList.map((item) => ({
        ...item,
        updateDesc: (item.updateDesc || "").trim(),
        expand: false,
        isExpandable: false,
      }));
      // 无搜索且第一页时，第一条即为最新版本
      if (!isLoadMore && !keyword && list.length) {
        this.latestId = list[0]._id;
        this.setData({ latestId: this.latestId });
      }

      if (!isLoadMore) {
        this.setData(
          {
            versionList: list,
            page: 1,
            noMore: list.length < pageSize,
            unlocked: this.getUnlockedMap(list),
          },
          () => {
            setTimeout(() => this.calcTextOverflow(), 200);
          },
        );
      } else {
        const newList = [...this.data.versionList, ...list];
        this.setData(
          {
            versionList: newList,
            page: page,
            noMore: list.length < pageSize,
            unlocked: this.getUnlockedMap(newList),
          },
          () => {
            setTimeout(() => this.calcTextOverflow(), 200);
          },
        );
      }
    } catch (err) {
      wx.showToast({ title: "读取列表失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ isRequesting: false });
    }
  },

  calcTextOverflow() {
    setTimeout(() => {
      const query = wx.createSelectorQuery().in(this);
      query.selectAll(".log-text").boundingClientRect();
      query.exec((res) => {
        const rectList = res[0] || [];
        const list = [...this.data.versionList];
        const LIMIT_HEIGHT = 60;
        rectList.forEach((rect, idx) => {
          if (!rect) return;
          list[idx].isExpandable = rect.height > LIMIT_HEIGHT;
        });
        this.setData({ versionList: list });
      });
    }, 250);
  },

  onSearchInput: debounce(function (e) {
    const keyword = e.detail.value.toLowerCase();
    this.setData({ keyword }, () => {
      this.loadVersionList(false);
    });
  }, 300),

  clearSearch() {
    this.setData({ keyword: "" }, () => {
      this.loadVersionList(false);
    });
  },

  // 刷新当前版本列表（保留搜索关键词）
  refreshList() {
    if (this.data.isRequesting) return;
    this.loadVersionList(false);
  },

  toggleExpand(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.versionList.map((item) => {
      if (item._id === id) item.expand = !item.expand;
      return item;
    });
    this.setData({ versionList: list });
  },

  showQrcodeModal() {
    this.setData({ showQrcode: true });
  },
  closeQrcode() {
    this.setData({ showQrcode: false });
  },
  previewImg() {
    wx.previewImage({ urls: ["/images/ewm.jpg"] });
  },

  stopBubble() {},

  onTitleTap() {
    app.globalData.adminClickCount++;
    clearTimeout(app.globalData.adminClickTimer);
    app.globalData.adminClickTimer = setTimeout(() => {
      app.globalData.adminClickCount = 0;
    }, 2000);
    if (app.globalData.adminClickCount >= 5) {
      app.globalData.adminClickCount = 0;
      this.setData({ showAdminPwdModal: true });
    }
  },

  async onAdminPwdConfirm(e) {
    const inputPwd = e.detail.pwd.trim();
    wx.showLoading();
    try {
      const res = await wx.cloud.callFunction({ name: "getAdminConfig" });
      const realPwd = res.result.publish_password;
      if (inputPwd === realPwd) {
        wx.navigateTo({ url: "/pages/admin/admin" });
        this.setData({ showAdminPwdModal: false });
      } else {
        wx.showToast({ title: "管理员密码错误", icon: "none" });
      }
    } catch (err) {
      wx.showToast({ title: "配置读取失败", icon: "none" });
    }
    wx.hideLoading();
  },

  // 右上角转发分享
  onShareAppMessage() {
    return {
      title: "微信PC历史版本查询",
      path: "/pages/index/index",
      imageUrl: "", // 可填线上分享图，不填默认截图
    };
  },
});
