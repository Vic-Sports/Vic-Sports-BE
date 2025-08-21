import User from '../models/user.js';
import logger from '../utils/logger.js';

export class UserService {
  static async getAllUsers(query = {}) {
    try {
      const { page = 1, limit = 10, keyword = '', status } = query;

      const filter = {};

      if (keyword) {
        filter.$or = [
          { fullName: { $regex: keyword, $options: 'i' } },
          { email: { $regex: keyword, $options: 'i' } },
        ];
      }

      if (status === 'true') {
        filter.status = true;
      } else if (status === 'false') {
        filter.status = false;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const total = await User.countDocuments(filter);
      const users = await User.find(filter)
        .select('-password')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      return { users, total };
    } catch (error) {
      logger.error('Error fetching users', { error: error.message });
      throw error;
    }
  }
}
