export const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEklEQVR42mP8/5+hHgAHggJ/l6uL1gAAAABJRU5ErkJggg=="; // 1x1 pixel
export const pngBody = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
export const EXPIRATION_TTL = 86400;

export const getDateISO = () => new Date().toISOString(); //.replace(/\.\d{3}Z$/, "Z");

export const getSessionId = async (input: { ip: string; userAgent: string; postId: string }) => {
  const { ip, userAgent, postId } = input;
  const [date, _] = getDateISO().split("T");
  const key = [date, ip, userAgent, postId].join("|");

  const buffer = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const shortBytes = new Uint8Array(hashBuffer).slice(0, 16); // 128 bit
  const shortBase64 = btoa(String.fromCharCode(...shortBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return shortBase64;
};
