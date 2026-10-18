/**
 * Rewarded-ad hook used by skins with `unlock: { type: 'ad' }`.
 * Stub: resolves `true` immediately. Ad SDKs (e.g. react-native-google-mobile-ads) need native code
 * that Expo Go doesn't ship, so the real implementation lands with an EAS development build.
 * Resolve `true` only when the user watched the ad to the end.
 */
export async function showRewardedAd(): Promise<boolean> {
  return true;
}
