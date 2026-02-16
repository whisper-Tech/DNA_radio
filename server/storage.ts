import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByDeviceFingerprint(deviceFingerprint: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByDeviceFingerprint(deviceFingerprint: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.deviceFingerprint === deviceFingerprint);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    // This is a lightweight in-memory storage used by template code.
    // The real app uses DB-backed users; keep this type-correct for `tsc`.
    const user: User = {
      id,
      deviceFingerprint: insertUser.deviceFingerprint,
      createdAt: new Date(),
      lastSeenAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();
