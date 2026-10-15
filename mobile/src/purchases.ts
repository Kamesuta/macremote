import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

// The entitlement that unlocks the app. Create it in the RevenueCat dashboard and attach the yearly product.
export const ENTITLEMENT = 'pro';
// Public SDK keys (safe to ship), set as EXPO_PUBLIC_* in eas.json / the build environment.
const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
});
export const purchasesConfigured = !!KEY;

let ready = false;
export function setupPurchases(): void {
  if (ready || !KEY) return;
  Purchases.configure({ apiKey: KEY });
  ready = true;
}

export const hasPro = (info: CustomerInfo): boolean => !!info.entitlements.active[ENTITLEMENT];

export async function checkPro(): Promise<boolean> {
  return hasPro(await Purchases.getCustomerInfo());
}

export function onProChange(cb: (pro: boolean) => void): () => void {
  const listener = (info: CustomerInfo) => cb(hasPro(info));
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => { Purchases.removeCustomerInfoUpdateListener(listener); };
}

// The yearly package from the current offering (falls back to whatever the offering holds first).
export async function loadPackage(): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.annual ?? offerings.current?.availablePackages[0] ?? null;
}

// Free-trial wording from the store's own data, e.g. "3-day free trial". Null when there is no free intro offer.
export function trialLabel(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const unit = intro.periodUnit.toLowerCase();
  const n = intro.periodNumberOfUnits * intro.cycles;
  return `${n}-${unit} free trial`;
}

export async function buy(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return hasPro(customerInfo);
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

export async function restore(): Promise<boolean> {
  return hasPro(await Purchases.restorePurchases());
}
