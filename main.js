const fs = require("fs");
const path = require("path");
const axios = require("axios");
const readline = require("readline");
const { DateTime } = require("luxon");
const logger = require("./config/logger");
const printBanner = require("./config/banner");

// Constants and configurations
const API_CONFIG = {
  BASE_URL: "https://api.paws.community/v1",
  ENDPOINTS: {
    AUTH: "/user/auth",
    USER_INFO: "/user",
    WALLET: "/user/wallet",
    QUESTS_LIST: "/quests/list",
    QUEST_COMPLETE: "/quests/completed",
    QUEST_CLAIM: "/quests/claim",
  },
  HEADERS: {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US;q=0.6,en;q=0.5",
    "Content-Type": "application/json",
    Origin: "https://app.paws.community",
    Referer: "https://app.paws.community/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
  },
};

// API Service class to handle all HTTP requests
class ApiService {
  constructor() {
    this.headers = API_CONFIG.HEADERS;
  }

  getAuthHeaders(token) {
    return {
      ...this.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  async makeRequest(config, maxRetries = 3, retryDelay = 5000) {
    let attempt = 1;
    while (attempt <= maxRetries) {
      try {
        return await axios(config);
      } catch (error) {
        if (attempt === maxRetries) throw error;
        logger.warn(
          `Attempt ${attempt}/${maxRetries} failed: ${
            error.message
          }. Retrying in ${retryDelay / 1000}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        attempt++;
      }
    }
  }

  async authenticate(initData) {
    const payload = {
      data: initData,
      referralCode: "vuY5ILO1",
    };

    try {
      const response = await this.makeRequest({
        method: "post",
        url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}`,
        data: payload,
        headers: this.headers,
      });

      if (response.status === 201 && response.data.success) {
        const [token, userData] = response.data.data;
        return {
          success: true,
          token,
          ...this.extractUserData(userData),
        };
      }
      return { success: false, error: "Authentication failed" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  extractUserData(userData) {
    const { gameData, userData: userInfo } = userData;

    return {
      balance: gameData.balance,
      username: userInfo.username,
      firstname: userInfo.firstname,
      wallet: userInfo.wallet,
      claimStreak: {
        lastClaimDate: userData.claimStreakData?.lastClaimDate,
        currentStreak: userData.claimStreakData?.claimStreak,
      },
      allocation: {
        hamster: userData.allocationData?.hamster ?? {
          initial: 0,
          converted: 0,
        },
        telegram: userData.allocationData?.telegram ?? {
          premium: false,
          age: 0,
          year: 0,
          converted: 0,
        },
        paws: userData.allocationData?.paws ?? { converted: 0 },
        dogs: userData.allocationData?.dogs ?? {
          initial: 0,
          converted: 0,
          percent: 0,
        },
        notcoin: userData.allocationData?.notcoin ?? {
          initial: 0,
          converted: 0,
          createAt: null,
        },
        total: userData.allocationData?.total ?? 0,
      },
    };
  }

  async getUserInfo(token) {
    try {
      const response = await this.makeRequest({
        method: "get",
        url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.USER_INFO}`,
        headers: this.getAuthHeaders(token),
      });

      if (response.status === 200 && response.data.success) {
        return {
          success: true,
          ...this.extractUserData(response.data.data),
        };
      }
      return { success: false, error: "Failed to get user info" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async linkWallet(token, wallet) {
    try {
      const response = await this.makeRequest({
        method: "post",
        url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WALLET}`,
        headers: this.getAuthHeaders(token),
        data: { wallet },
      });

      return {
        success: response.status === 201 && response.data.success,
        error: response.status !== 201 ? "Failed to link wallet" : null,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Token Manager class to handle token operations
class TokenManager {
  constructor() {
    this.tokenFile = path.join(__dirname, "token.json");
    this.tokens = this.loadTokens();
  }

  loadTokens() {
    try {
      return fs.existsSync(this.tokenFile)
        ? JSON.parse(fs.readFileSync(this.tokenFile, "utf8"))
        : {};
    } catch (error) {
      logger.error(`Error reading token file: ${error.message}`);
      return {};
    }
  }

  saveToken(userId, token) {
    try {
      this.tokens[userId] = token;
      fs.writeFileSync(this.tokenFile, JSON.stringify(this.tokens, null, 2));
      logger.info(`Token saved for user ${userId}`);
    } catch (error) {
      logger.error(`Error saving token: ${error.message}`);
    }
  }

  isExpired(token) {
    try {
      const [, payload] = token.split(".");
      const decodedPayload = JSON.parse(
        Buffer.from(payload, "base64").toString()
      );
      const now = Math.floor(DateTime.now().toSeconds());

      if (decodedPayload.exp) {
        const expirationDate = DateTime.fromSeconds(
          decodedPayload.exp
        ).toLocal();
        logger.info(
          `Token expires on: ${expirationDate.toFormat("yyyy-MM-dd HH:mm:ss")}`
        );
        return now > decodedPayload.exp;
      }

      logger.warn("Perpetual token, expiration time not readable");
      return false;
    } catch (error) {
      logger.error(`Error checking token expiration: ${error.message}`);
      return true;
    }
  }
}

// Quest Manager class to handle quest-related operations
class QuestManager {
  constructor(apiService) {
    this.apiService = apiService;
  }

  async getQuestsList(token) {
    try {
      const response = await this.apiService.makeRequest({
        method: "get",
        url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.QUESTS_LIST}`,
        headers: this.apiService.getAuthHeaders(token),
      });

      if (response.status === 200 && response.data.success) {
        return {
          success: true,
          data: response.data.data.filter((quest) => !quest.progress.claimed),
        };
      }
      return { success: false, error: "Failed to get quests list" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async completeQuest(token, questId) {
    try {
      const response = await this.apiService.makeRequest({
        method: "post",
        url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.QUEST_COMPLETE}`,
        headers: this.apiService.getAuthHeaders(token),
        data: { questId },
      });

      const {
        status,
        data: { success, data },
      } = response;

      if ((status === 200 || status === 201) && success) {
        return { success: true, data };
      }

      if ((status === 200 || status === 201) && data === true) {
        logger.info(`Quest ${questId} not completed, proceeding to claim...`);
        return { success: true, needsClaim: true };
      }

      if (data === false) {
        logger.warn(`Requirements not met to complete quest ${questId}`);
      }

      return { success: false, error: "Failed to complete quest" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async claimQuest(token, questId, questData) {
    try {
      const response = await this.apiService.makeRequest({
        method: "post",
        url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.QUEST_CLAIM}`,
        headers: this.apiService.getAuthHeaders(token),
        data: { questId },
      });

      if (response) {
        const reward = questData.rewards[0].amount;
        logger.info(
          `Successfully completed ${questData.title} | Reward: ${reward}`
        );
        return { success: true };
      }
      return { success: false, error: "Failed to claim quest reward" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processQuests(token) {
    try {
      const questsResult = await this.getQuestsList(token);
      if (!questsResult.success) {
        logger.error(`Error getting quests list: ${questsResult.error}`);
        return;
      }

      for (const quest of questsResult.data) {
        logger.info(`Processing quest: ${quest.title}`);
        await this.processQuest(token, quest);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      logger.error(`Error processing quests: ${error.message}`);
    }
  }

  async processQuest(token, quest) {
    const completeResult = await this.completeQuest(token, quest._id);
    if (!completeResult.success) {
      logger.error(
        `Error completing quest ${quest.title}: ${completeResult.error}`
      );
      return;
    }

    if (completeResult.needsClaim) {
      const claimResult = await this.claimQuest(token, quest._id, quest);
      if (!claimResult.success) {
        logger.error(
          `Error claiming quest reward ${quest.title}: ${claimResult.error}`
        );
      }
    }
  }
}

// Main PawsClient class
class PawsClient {
  constructor() {
    this.apiService = new ApiService();
    this.tokenManager = new TokenManager();
    this.questManager = new QuestManager(this.apiService);
    this.wallets = this.loadWallets();
  }

  loadWallets() {
    try {
      const walletFile = path.join(__dirname, "wallet.txt");
      return fs.existsSync(walletFile)
        ? fs
            .readFileSync(walletFile, "utf8")
            .replace(/\r/g, "")
            .split("\n")
            .filter(Boolean)
        : [];
    } catch (error) {
      logger.error(`Error reading wallet file: ${error.message}`);
      return [];
    }
  }

  validateWalletFile() {
    const dataFile = path.join(__dirname, "data.txt");
    const data = fs
      .readFileSync(dataFile, "utf8")
      .replace(/\r/g, "")
      .split("\n")
      .filter(Boolean);

    if (this.wallets.length !== data.length) {
      logger.error(
        `Mismatch between number of wallets (${this.wallets.length}) and data entries (${data.length})`
      );
      return false;
    }
    return true;
  }

  async processAccount(accountData, walletAddress) {
    const userData = JSON.parse(
      decodeURIComponent(accountData.split("user=")[1].split("&")[0])
    );
    const userId = userData.id;
    const firstName = userData.first_name;

    logger.info(`=== Processing account for ${firstName} ===`);

    const token = await this.ensureValidToken(userId, accountData);
    if (!token) return;

    // Dapatkan informasi user termasuk claim streak dan allocation
    const userInfo = await this.apiService.getUserInfo(token);
    if (userInfo.success) {
      // Account Info
      logger.info(`=== Account Information ===`);
      logger.info(`Username: ${userInfo.username}`);
      logger.info(`Balance: ${userInfo.balance}`);

      // Claim Streak Info
      logger.info(`=== Claim Streak Information ===`);
      logger.info(`Current Streak: ${userInfo.claimStreak.currentStreak}`);
      logger.info(
        `Last Claim: ${new Date(
          userInfo.claimStreak.lastClaimDate
        ).toLocaleString()}`
      );

      // Allocation Info
      logger.info("=== Allocation Information ===");
      logger.info("Hamster:");
      logger.info(`  > Initial: ${userInfo.allocation.hamster.initial}`);
      logger.info(`  > Converted: ${userInfo.allocation.hamster.converted}`);

      logger.info("Telegram:");
      logger.info(`  > Premium: ${userInfo.allocation.telegram.premium}`);
      logger.info(`  > Age: ${userInfo.allocation.telegram.age} days`);
      logger.info(`  > Year: ${userInfo.allocation.telegram.year}`);
      logger.info(`  > Converted: ${userInfo.allocation.telegram.converted}`);

      logger.info("Paws:");
      logger.info(`  > Converted: ${userInfo.allocation.paws.converted}`);

      logger.info("Dogs:");
      logger.info(`  > Initial: ${userInfo.allocation.dogs.initial}`);
      logger.info(`  > Converted: ${userInfo.allocation.dogs.converted}`);
      logger.info(`  > Percent: ${userInfo.allocation.dogs.percent}%`);

      logger.info("Notcoin:");
      logger.info(`  > Initial: ${userInfo.allocation.notcoin.initial}`);
      logger.info(`  > Converted: ${userInfo.allocation.notcoin.converted}`);
      logger.info(
        `  > Created At: ${userInfo.allocation.notcoin.createAt || "N/A"}`
      );

      logger.info(`Total Allocation: ${userInfo.allocation.total}`);

      // Wallet Info
      logger.info("=== Wallet Information ===");
      if (!userInfo.wallet) {
        logger.warn(
          `Account not linked to wallet. Starting linking process...`
        );
        await this.ensureWalletLinked(token, walletAddress);
      } else {
        logger.info(`Wallet Address: ${userInfo.wallet}`);
      }
    } else {
      logger.error(`Error getting user info: ${userInfo.error}`);
    }

    // Process Quests
    logger.info("=== Processing Quests ===");
    await this.questManager.processQuests(token);
  }

  async ensureValidToken(userId, accountData) {
    let userToken = this.tokenManager.tokens[userId];

    if (!userToken || this.tokenManager.isExpired(userToken)) {
      logger.warn(`New token needed for user ${userId}`);
      const authResult = await this.apiService.authenticate(accountData);

      if (!authResult.success) {
        logger.error(`Login failed! ${authResult.error}`);
        return null;
      }

      userToken = authResult.token;
      this.tokenManager.saveToken(userId, userToken);
    }

    return userToken;
  }

  async ensureWalletLinked(token, walletAddress) {
    const linkResult = await this.apiService.linkWallet(token, walletAddress);
    if (linkResult.success) {
      logger.info(`Successfully linked wallet: ${walletAddress}`);
    } else {
      logger.error(`Error linking wallet: ${linkResult.error}`);
    }
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  async countdown(seconds) {
    let remainingTime = seconds;
    while (remainingTime >= 0) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`Next cycle in: ${this.formatTime(remainingTime)}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      remainingTime--;
    }
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
  }

  async main() {
    printBanner();

    if (!this.validateWalletFile()) {
      process.exit(1);
    }

    const dataFile = path.join(__dirname, "data.txt");
    const data = fs
      .readFileSync(dataFile, "utf8")
      .replace(/\r/g, "")
      .split("\n")
      .filter(Boolean);

    while (true) {
      logger.info("=== Starting New Cycle ===");
      for (let i = 0; i < data.length; i++) {
        await this.processAccount(data[i], this.wallets[i]);
        if (i < data.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      logger.info("=== Cycle Completed ===");
      await this.countdown(1440 * 60); // 24 hours in seconds
    }
  }
}

// Start the application
const client = new PawsClient();
client.main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
