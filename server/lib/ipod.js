import { spawn } from "node:child_process";
import { existsSync, readdirSync, statfsSync } from "node:fs";
import { basename, join } from "node:path";

const VOLUMES_DIR = "/Volumes";

/**
 * An iPod in disk-use mode mounts a volume whose root contains an
 * `iPod_Control` directory. That folder is the reliable iPod signature.
 */
export function looksLikeIpod(volumePath) {
  if (!volumePath) return false;
  return existsSync(join(volumePath, "iPod_Control"));
}

function volumeSpace(volumePath) {
  try {
    const fs = statfsSync(volumePath);
    return {
      capacityBytes: Number(fs.blocks) * Number(fs.bsize),
      freeBytes: Number(fs.bavail) * Number(fs.bsize),
    };
  } catch {
    return { capacityBytes: 0, freeBytes: 0 };
  }
}

/** Scan /Volumes for mounted iPod disks (disk-use enabled). */
export function scanMountedIpods() {
  let names = [];
  try {
    names = readdirSync(VOLUMES_DIR);
  } catch {
    return [];
  }
  return names
    .map((name) => join(VOLUMES_DIR, name))
    .filter((path) => looksLikeIpod(path))
    .map((path) => ({ name: basename(path), volumePath: path, diskUseEnabled: true, ...volumeSpace(path) }));
}

function walkUsbItems(items, out) {
  for (const item of items || []) {
    const name = String(item._name || "");
    if (/ipod/i.test(name)) {
      out.push({
        name,
        serial: item.serial_num || "",
        manufacturer: item.manufacturer || "",
        usbCapacityBytes: Number(item.size_in_bytes) || 0,
      });
    }
    if (Array.isArray(item._items)) walkUsbItems(item._items, out);
  }
}

/**
 * Detect iPods on the USB bus via system_profiler. Catches the device even when
 * disk use is OFF (no mounted volume). Resolves to [] on any failure/timeout.
 */
export function scanUsbIpods(timeoutMs = 8000) {
  return new Promise((resolve) => {
    let stdout = "";
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let child;
    try {
      child = spawn("system_profiler", ["SPUSBDataType", "-json"], { stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return done([]);
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done([]);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.on("error", () => {
      clearTimeout(timer);
      done([]);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const data = JSON.parse(stdout);
        const out = [];
        walkUsbItems(data.SPUSBDataType, out);
        done(out);
      } catch {
        done([]);
      }
    });
  });
}

/**
 * Merge mounted-volume and USB detection into a single device record.
 * @returns {Promise<{ connected: boolean, device: object, mounted: object[], usb: object[] }>}
 */
export async function detectIpods() {
  const mounted = scanMountedIpods();
  const usb = await scanUsbIpods();
  const connected = mounted.length > 0 || usb.length > 0;

  const primaryMount = mounted[0] || null;
  const primaryUsb = usb[0] || null;

  const device = connected
    ? {
        connected: true,
        name: primaryMount?.name || primaryUsb?.name || "iPod",
        usbName: primaryUsb?.name || "",
        serial: primaryUsb?.serial || "",
        volumePath: primaryMount?.volumePath || "",
        capacityBytes: primaryMount?.capacityBytes || primaryUsb?.usbCapacityBytes || 0,
        freeBytes: primaryMount?.freeBytes || 0,
        diskUseEnabled: Boolean(primaryMount),
        canSyncViaFinder: true,
      }
    : { connected: false };

  return { connected, device, mounted, usb };
}

/**
 * Verify a user-selected path actually looks like an iPod volume before the app
 * trusts it for status display. Used by the manual "Choose iPod volume" fallback.
 */
export function verifyIpodVolume(volumePath) {
  if (!volumePath || !existsSync(volumePath)) {
    return { ok: false, error: "That path does not exist." };
  }
  if (!looksLikeIpod(volumePath)) {
    return { ok: false, error: "That volume does not look like an iPod (no iPod_Control folder found)." };
  }
  return {
    ok: true,
    name: basename(volumePath),
    volumePath,
    diskUseEnabled: true,
    canSyncViaFinder: true,
    ...volumeSpace(volumePath),
  };
}
