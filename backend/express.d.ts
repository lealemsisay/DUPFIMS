import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    authenticatedUser?: {
      id: string;
      username: string;
      email: string | null;
      fullName: string;
      mustChangePassword: boolean;
      roles: Array<{
        name: string;
        permissions: string[];
      }>;
    };
    sessionId?: string;
  }
}
