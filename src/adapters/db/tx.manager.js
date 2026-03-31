'use strict';

class TransactionManager {
  constructor({ pool }) {
    this.pool = pool;
  }

  async runInTransaction(handler) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await handler(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (_rollbackError) {
        // rollback best-effort
      }
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = { TransactionManager };
