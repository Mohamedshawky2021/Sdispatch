// Web Authentication API (WebAuthn / Passkeys / Biometrics) Utility
// Supports Fingerprint, Face ID, Touch ID, Windows Hello, and Platform Authenticators

const WEBAUTHN_STORAGE_KEY = 'sukari_admin_webauthn_cred_v1';

// Convert ArrayBuffer to Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function isWebAuthnSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    window.navigator &&
    window.navigator.credentials &&
    typeof window.PublicKeyCredential !== 'undefined'
  );
}

export async function isPlatformBiometricsAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {
    return false;
  }
  return true;
}

export function hasRegisteredBiometrics(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(WEBAUTHN_STORAGE_KEY);
}

export function getRegisteredBiometricDate(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(WEBAUTHN_STORAGE_KEY + '_date');
  return raw || null;
}

export async function registerBiometricPasskey(adminName = 'مدير نظام دسباتش السكري'): Promise<{ success: boolean; error?: string }> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: 'المتصفح الحالي لا يدعم Web Authentication API.' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'نظام دسباتش منجم السكري - التحكم الإداري',
        id: window.location.hostname || undefined,
      },
      user: {
        id: userId,
        name: 'admin@sukari.mine',
        displayName: adminName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },  // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        requireResidentKey: false,
      },
      timeout: 60000,
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'لم يتم إنشاء المفتاح الحيوي.' };
    }

    const credIdBase64 = bufferToBase64(credential.rawId);
    localStorage.setItem(WEBAUTHN_STORAGE_KEY, credIdBase64);
    localStorage.setItem(WEBAUTHN_STORAGE_KEY + '_date', new Date().toISOString());

    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as { name?: string; message?: string };
    if (errorObj?.name === 'NotAllowedError') {
      return { success: false, error: 'تم إلغاء عملية المصادقة الحيوية بواسطة المستخدم أو نفاد الوقت.' };
    }
    if (errorObj?.name === 'InvalidStateError') {
      return { success: false, error: 'تم تسجيل هذا المفتاح الحيوي مسبقاً على هذا الجهاز.' };
    }
    return { success: false, error: errorObj?.message || 'تعذر تسجيل المصادقة الحيوية على هذا الجهاز.' };
  }
}

export async function verifyBiometricPasskey(): Promise<{ success: boolean; error?: string }> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: 'المتصفح لا يدعم المصادقة الحيوية.' };
  }

  const storedCredId = localStorage.getItem(WEBAUTHN_STORAGE_KEY);
  if (!storedCredId) {
    return { success: false, error: 'لم يتم تسجيل بصمة حيوية على هذا الجهاز بعد. يرجى الدخول برمز PIN أولاً وتفعيلها.' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credentialRawId = base64ToUint8Array(storedCredId);

    const getOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [
        {
          id: credentialRawId.buffer as ArrayBuffer,
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'preferred',
      timeout: 60000,
    };

    const assertion = await navigator.credentials.get({
      publicKey: getOptions,
    });

    if (assertion) {
      return { success: true };
    }
    return { success: false, error: 'فشلت عملية المصادقة الحيوية.' };
  } catch (err: unknown) {
    const errorObj = err as { name?: string; message?: string };
    if (errorObj?.name === 'NotAllowedError') {
      return { success: false, error: 'تم إلغاء طلب المصادقة الحيوية أو رفض البصمة.' };
    }
    return { success: false, error: errorObj?.message || 'تعذر التحقق من البصمة.' };
  }
}

export function removeBiometricPasskey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(WEBAUTHN_STORAGE_KEY);
  localStorage.removeItem(WEBAUTHN_STORAGE_KEY + '_date');
}
