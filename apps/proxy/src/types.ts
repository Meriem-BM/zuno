export interface Env {
  TURNKEY_API_BASE_URL?: string;
  TURNKEY_ORGANIZATION_ID: string;
  TURNKEY_API_PUBLIC_KEY: string;
  TURNKEY_API_PRIVATE_KEY: string;
}

export interface SubOrgInfo {
  subOrganizationId: string;
  walletId?: string;
  walletAddress?: string;
}

export interface InitOtpBody {
  email?: string;
}

export interface VerifyOtpBody {
  otpId?: string;
  otpCode?: string;
}

export interface LoginBody {
  email?: string;
  verificationToken?: string;
  publicKey?: string;
}
