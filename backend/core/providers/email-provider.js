/**
 * Abstract email provider interface.
 * Implement for Gmail, Outlook, Yahoo, etc.
 */
export class EmailProvider {
  async getAccessToken() {
    throw new Error('getAccessToken() not implemented');
  }

  async fetchMessage(messageId) {
    throw new Error('fetchMessage() not implemented');
  }

  async fetchHistorySince(historyId) {
    throw new Error('fetchHistorySince() not implemented');
  }

  async setupPushNotifications() {
    throw new Error('setupPushNotifications() not implemented');
  }

  async renewPushNotifications() {
    throw new Error('renewPushNotifications() not implemented');
  }
}
