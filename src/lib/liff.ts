const LIFF_ID = import.meta.env.VITE_LINE_LIFF_ID || ''

export async function initLIFF() {
  const { liff } = await import('@line/liff')
  await liff.init({ liffId: LIFF_ID })
  return liff
}

export async function getProfile() {
  const { liff } = await import('@line/liff')
  if (!liff.isLoggedIn()) {
    liff.login()
    return null
  }
  return await liff.getProfile()
}

export async function getAccessToken() {
  const { liff } = await import('@line/liff')
  return liff.getAccessToken()
}

export async function getDecodedIDToken() {
  const { liff } = await import('@line/liff')
  return liff.getDecodedIDToken()
}

export function isLoggedIn() {
  const { liff } = window as any
  return liff?.isLoggedIn() || false
}

export async function openExternalBrowser(url: string) {
  const { liff } = await import('@line/liff')
  await liff.openWindow({ url, external: true })
}

export default { initLIFF, getProfile, getAccessToken, getDecodedIDToken, isLoggedIn, openExternalBrowser }