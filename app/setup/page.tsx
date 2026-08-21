"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Wifi,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  RefreshCcw,
} from "lucide-react";

// ============================================================
// ESP32
// ============================================================

const ESP32_URL = "http://192.168.4.1";

// Scan configuration
const SCAN_POLL_INTERVAL_MS = 2000;
const SCAN_POLL_MAX_ATTEMPTS = 30;

// Individual HTTP request timeout
const REQUEST_TIMEOUT_MS = 8000;

// Number of temporary failures we tolerate
const MAX_TEMPORARY_ERRORS = 8;

// ============================================================
// TYPES
// ============================================================

interface Network {
  ssid: string;
  rssi: number;
  channel: number;
  secure: boolean;
}

interface DeviceStatus {
  deviceId: string;
  apSSID: string;
  apIP: string;
  apChannel: number;

  staConnected: boolean;
  staConnecting: boolean;
  scanning: boolean;

  staIP: string;
}

type Status =
  | "idle"
  | "scanning"
  | "select"
  | "connecting"
  | "success"
  | "error";

// ============================================================
// PAGE
// ============================================================

export default function SetupPage() {
  const router = useRouter();

  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------

  const [networks, setNetworks] = useState<Network[]>([]);

  const [selectedSSID, setSelectedSSID] =
    useState("");

  const [selectedChannel, setSelectedChannel] =
    useState(0);

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [status, setStatus] =
    useState<Status>("idle");

  const [errorMsg, setErrorMsg] =
    useState("");

  const [deviceStatus, setDeviceStatus] =
    useState<DeviceStatus | null>(null);

  // Used to cancel polling.
  const cancelRef =
    useRef(false);

  // Prevent duplicate scan calls.
  const scanningRef =
    useRef(false);

  // ----------------------------------------------------------
  // Initial device status
  // ----------------------------------------------------------

  useEffect(() => {
    loadDeviceStatus();
  }, []);

  // ==========================================================
  // DEVICE STATUS
  // ==========================================================

  async function loadDeviceStatus() {
    try {
      const response =
        await fetchWithTimeout(
          `${ESP32_URL}/api/status`,
          {},
          REQUEST_TIMEOUT_MS
        );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      setDeviceStatus(data);
    } catch (error) {
      console.log(
        "ESP32 status unavailable"
      );
    }
  }

  // ==========================================================
  // SCAN
  // ==========================================================

  async function scanNetworks() {
    // Prevent duplicate scans.
    if (scanningRef.current) {
      return;
    }

    scanningRef.current = true;

    cancelRef.current = false;

    setStatus("scanning");
    setErrorMsg("");

    setNetworks([]);

    setSelectedSSID("");
    setSelectedChannel(0);
    setPassword("");

    let temporaryErrors = 0;

    try {
      // ------------------------------------------------------
      // STEP 1
      // Tell ESP32 to start scanning.
      // ------------------------------------------------------

      console.log(
        "Starting ESP32 WiFi scan..."
      );

      const startResponse =
        await fetchWithTimeout(
          `${ESP32_URL}/api/scan`,
          {},
          5000
        );

      if (!startResponse.ok) {

        throw new Error(
          `ESP32 returned HTTP ${startResponse.status}`
        );
      }

      const startData =
        await startResponse.json();

      console.log(
        "Scan start response:",
        startData
      );

      // Device is currently connecting.
      if (
        startData.status === "busy"
      ) {

        throw new Error(
          "The ESP32 is currently connecting to Wi-Fi. Please wait and try again."
        );
      }

      // Scan already running.
      if (
        startData.status === "scanning"
      ) {

        console.log(
          "ESP32 scan already running."
        );
      }

      // ------------------------------------------------------
      // STEP 2
      // Poll scan result.
      // ------------------------------------------------------

      for (
        let attempt = 0;
        attempt < SCAN_POLL_MAX_ATTEMPTS;
        attempt++
      ) {

        if (
          cancelRef.current
        ) {

          return;
        }

        // Wait before asking again.
        await sleep(
          SCAN_POLL_INTERVAL_MS
        );

        try {

          console.log(
            `Checking scan result ${attempt + 1}/${SCAN_POLL_MAX_ATTEMPTS}`
          );

          const response =
            await fetchWithTimeout(
              `${ESP32_URL}/api/scan/result`,
              {
                cache: "no-store",
              },
              REQUEST_TIMEOUT_MS
            );

          // --------------------------------------------------
          // Temporary HTTP error
          // --------------------------------------------------

          if (!response.ok) {

            temporaryErrors++;

            console.warn(
              "Temporary ESP32 HTTP error:",
              response.status
            );

            if (
              temporaryErrors >=
              MAX_TEMPORARY_ERRORS
            ) {

              throw new Error(
                "The connection to the ESP32 was lost. Reconnect to ESP32-Setup and try again."
              );
            }

            continue;
          }

          const data =
            await response.json();

          // Communication is working again.
          temporaryErrors = 0;

          console.log(
            "Scan response:",
            data
          );

          // --------------------------------------------------
          // Scan finished
          // --------------------------------------------------

          if (
            data.status === "done"
          ) {

            const foundNetworks: Network[] =
              Array.isArray(
                data.networks
              )
                ? data.networks
                    .filter(
                      (network: Network) =>
                        typeof network.ssid ===
                          "string" &&
                        network.ssid.trim()
                          .length > 0
                    )
                    .sort(
                      (
                        a: Network,
                        b: Network
                      ) =>
                        b.rssi -
                        a.rssi
                    )
                : [];

            console.log(
              "Networks found:",
              foundNetworks
            );

            setNetworks(
              foundNetworks
            );

            setStatus(
              "select"
            );

            return;
          }

          // --------------------------------------------------
          // Still scanning
          // --------------------------------------------------

          if (
            data.status === "scanning"
          ) {

            continue;
          }

          // --------------------------------------------------
          // Idle
          // --------------------------------------------------

          if (
            data.status === "idle"
          ) {

            continue;
          }

        } catch (error) {

          // --------------------------------------------------
          // Temporary network failure
          // --------------------------------------------------

          temporaryErrors++;

          console.warn(
            `Temporary ESP32 connection failure ${temporaryErrors}/${MAX_TEMPORARY_ERRORS}`,
            error
          );

          // Don't immediately fail.
          if (
            temporaryErrors <
            MAX_TEMPORARY_ERRORS
          ) {

            continue;
          }

          throw new Error(
            "The ESP32 became unreachable during the scan. Make sure you remain connected to ESP32-Setup and try again."
          );
        }
      }

      // ------------------------------------------------------
      // Scan timeout
      // ------------------------------------------------------

      throw new Error(
        "The Wi-Fi scan took too long. Please try scanning again."
      );

    } catch (error: any) {

      if (
        cancelRef.current
      ) {

        return;
      }

      console.error(
        "WiFi scan error:",
        error
      );

      setErrorMsg(
        error?.message ||
          "Could not scan for Wi-Fi networks."
      );

      setStatus(
        "error"
      );

    } finally {

      scanningRef.current =
        false;
    }
  }

  // ==========================================================
  // CANCEL SCAN
  // ==========================================================

  function cancelScan() {

    cancelRef.current =
      true;

    scanningRef.current =
      false;

    setStatus(
      "idle"
    );

    setErrorMsg(
      ""
    );
  }

  // ==========================================================
  // SELECT NETWORK
  // ==========================================================

  function selectNetwork(
    network: Network
  ) {

    setSelectedSSID(
      network.ssid
    );

    setSelectedChannel(
      network.channel
    );

    setPassword("");
  }

  // ==========================================================
  // SUBMIT WIFI CONFIG
  // ==========================================================

  async function submitConfig() {

    if (
      !selectedSSID
    ) {

      setErrorMsg(
        "Please select a Wi-Fi network."
      );

      return;
    }

    if (
      selectedChannel <= 0
    ) {

      setErrorMsg(
        "The selected Wi-Fi network has an invalid channel."
      );

      return;
    }

    setStatus(
      "connecting"
    );

    setErrorMsg("");

    try {

      const response =
        await fetchWithTimeout(
          `${ESP32_URL}/api/configure`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              ssid: selectedSSID,
              password,
              channel:
                selectedChannel,
            }),
          },
          5000
        );

      if (!response.ok) {

        const errorBody =
          await response
            .json()
            .catch(() => ({}));

        throw new Error(
          errorBody.error ||
            `Configuration failed: HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      console.log(
        "Configuration response:",
        data
      );

      // Give ESP32 time to connect.
      await pollForConnection();

    } catch (error: any) {

      console.error(
        "Configuration error:",
        error
      );

      setErrorMsg(
        error?.message ||
          "Could not configure the ESP32."
      );

      setStatus(
        "error"
      );
    }
  }

  // ==========================================================
  // POLL WIFI CONNECTION
  // ==========================================================

  async function pollForConnection(
    attempts = 12
  ) {

    for (
      let i = 0;
      i < attempts;
      i++
    ) {

      await sleep(
        2000
      );

      try {

        const response =
          await fetchWithTimeout(
            `${ESP32_URL}/api/status`,
            {
              cache: "no-store",
            },
            2500
          );

        if (!response.ok) {
          continue;
        }

        const data: DeviceStatus =
          await response.json();

        setDeviceStatus(
          data
        );

        console.log(
          "Connection status:",
          data
        );

        if (
          data.staConnected
        ) {

          setStatus(
            "success"
          );

          return;
        }

      } catch (error) {

        // ----------------------------------------------------
        // This is expected.
        //
        // Once the ESP32 joins the user's router,
        // 192.168.4.1 may disappear.
        // ----------------------------------------------------

        console.log(
          "ESP32 AP temporarily unavailable..."
        );
      }
    }

    throw new Error(
      "The ESP32 did not confirm the Wi-Fi connection. Check the password and try again."
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center px-4 py-8">

      <div className="w-full max-w-sm">

        {/* STATUS */}
        <div className="flex items-center gap-2 mb-4 text-xs">

          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === "success"
                ? "bg-emerald-400"
                : status === "error"
                ? "bg-rose-400"
                : "bg-cyan-400 animate-pulse"
            }`}
          />

          <span className="text-slate-500 font-mono uppercase tracking-wider">

            {status === "idle" &&
              (deviceStatus?.staConnected
                ? "Already connected"
                : "Ready to scan")}

            {status === "scanning" &&
              "Scanning"}

            {status === "select" &&
              "Select network"}

            {status === "connecting" &&
              "Connecting"}

            {status === "success" &&
              "Connected"}

            {status === "error" &&
              "Error"}

          </span>

        </div>

        {/* CARD */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6">

          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
            Device setup
          </h1>

          {deviceStatus?.staConnected &&
          status === "idle" ? (

            <p className="text-sm text-slate-500 mt-1 mb-6">

              Currently connected at{" "}

              <span className="font-mono text-slate-300">
                {deviceStatus.staIP}
              </span>

            </p>

          ) : (

            <p className="text-sm text-slate-500 mt-1 mb-6">
              Connect this device to your Wi-Fi network.
            </p>
          )}

          {/* ------------------------------------------------ */}
          {/* IDLE */}
          {/* ------------------------------------------------ */}

          {status === "idle" && (

            <button
              onClick={scanNetworks}
              className="w-full min-h-11 flex items-center justify-center gap-2 bg-cyan-400 text-slate-950 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
            >

              {deviceStatus?.staConnected ? (
                <RefreshCcw size={16} />
              ) : (
                <Wifi size={16} />
              )}

              {deviceStatus?.staConnected
                ? "Change network"
                : "Scan for networks"}

            </button>
          )}

          {/* ------------------------------------------------ */}
          {/* SCANNING */}
          {/* ------------------------------------------------ */}

          {status === "scanning" && (

            <div className="flex flex-col items-center gap-3 py-10">

              <Loader2
                className="animate-spin text-cyan-400"
                size={26}
              />

              <p className="text-sm text-slate-500">
                Looking for nearby networks…
              </p>

              <p className="text-xs text-slate-600 text-center">
                This can take a few seconds.
              </p>

              <button
                onClick={cancelScan}
                className="min-h-11 px-4 mt-1 border border-slate-800 rounded-lg text-sm text-slate-300"
              >
                Cancel
              </button>

            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* SELECT */}
          {/* ------------------------------------------------ */}

          {status === "select" && (

            <div className="space-y-4">

              <div className="flex items-center justify-between">

                <span className="text-xs font-mono uppercase tracking-wider text-slate-500">

                  {networks.length}{" "}
                  {networks.length === 1
                    ? "network"
                    : "networks"}{" "}
                  found

                </span>

                <button
                  onClick={scanNetworks}
                  className="flex items-center gap-1 text-xs text-cyan-400"
                >

                  <RotateCw size={12} />

                  Rescan

                </button>

              </div>

              {/* NO NETWORKS */}

              {networks.length === 0 ? (

                <div className="border border-slate-800 rounded-xl p-4 text-center">

                  <Wifi
                    size={24}
                    className="mx-auto mb-2 text-slate-600"
                  />

                  <p className="text-sm text-slate-400">
                    No Wi-Fi networks found.
                  </p>

                  <button
                    onClick={scanNetworks}
                    className="mt-3 text-xs text-cyan-400"
                  >
                    Scan again
                  </button>

                </div>

              ) : (

                <div className="space-y-1.5 max-h-64 overflow-y-auto -mx-1 px-1">

                  {networks.map(
                    (network) => (

                      <button
                        key={`${network.ssid}-${network.channel}`}
                        onClick={() =>
                          selectNetwork(network)
                        }
                        className={`w-full min-h-11 flex items-center justify-between gap-3 px-3 rounded-xl border text-left transition-colors ${
                          selectedSSID ===
                          network.ssid
                            ? "border-cyan-400 bg-cyan-400/10"
                            : "border-slate-800 bg-slate-950/50 active:bg-slate-800"
                        }`}
                      >

                        <span className="flex items-center gap-2 min-w-0">

                          {network.secure && (
                            <Lock
                              size={12}
                              className="text-slate-500 shrink-0"
                            />
                          )}

                          <span className="text-sm text-slate-200 truncate">

                            {network.ssid}

                          </span>

                        </span>

                        <SignalBars
                          rssi={
                            network.rssi
                          }
                        />

                      </button>
                    )
                  )}

                </div>
              )}

              {/* PASSWORD */}

              {selectedSSID && (

                <div className="space-y-3 pt-1">

                  <div className="relative">

                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      placeholder="Wi-Fi password"
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                      className="w-full min-h-11 bg-slate-950 border border-slate-800 rounded-xl px-3 pr-10 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          !showPassword
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                    >

                      {showPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}

                    </button>

                  </div>

                  <button
                    onClick={submitConfig}
                    className="w-full min-h-11 bg-cyan-400 text-slate-950 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
                  >

                    Connect to{" "}

                    <span className="font-mono">
                      {selectedSSID}
                    </span>

                  </button>

                </div>
              )}

            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* CONNECTING */}
          {/* ------------------------------------------------ */}

          {status === "connecting" && (

            <div className="flex flex-col items-center gap-3 py-10 text-center">

              <Loader2
                className="animate-spin text-cyan-400"
                size={24}
              />

              <p className="text-sm text-slate-500">

                Connecting to{" "}

                <span className="font-mono text-slate-300">
                  {selectedSSID}
                </span>

                …

              </p>

              <p className="text-xs text-slate-600">
                This can take up to 25 seconds.
              </p>

            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* SUCCESS */}
          {/* ------------------------------------------------ */}

          {status === "success" && (

            <div className="flex flex-col items-center gap-2 py-8 text-center">

              <CheckCircle2
                className="text-emerald-400"
                size={32}
              />

              <p className="text-sm font-medium text-slate-200">
                Device connected
              </p>

              <p className="text-xs text-slate-500 max-w-[28ch]">

                {deviceStatus?.staIP && (
                  <>
                    Device IP:{" "}

                    <span className="font-mono text-slate-300">
                      {deviceStatus.staIP}
                    </span>
                    <br />
                  </>
                )}

                Wi-Fi configuration completed successfully.

              </p>

              <button
                onClick={() =>
                  router.push("/auth")
                }
                className="w-full min-h-11 bg-cyan-400 text-slate-950 rounded-xl font-medium text-sm mt-3 active:scale-[0.98] transition-transform"
              >
                Continue to account setup
              </button>

              <button
                onClick={() => {
                  setStatus("idle");
                  loadDeviceStatus();
                }}
                className="flex items-center gap-2 min-h-11 px-4 mt-1 border border-slate-800 rounded-lg text-sm text-slate-300"
              >

                <RefreshCcw
                  size={14}
                />

                Connect to a different network

              </button>

            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* ERROR */}
          {/* ------------------------------------------------ */}

          {status === "error" && (

            <div className="flex flex-col items-center gap-3 py-8 text-center">

              <AlertCircle
                className="text-rose-400"
                size={28}
              />

              <p className="text-sm text-slate-300">
                {errorMsg}
              </p>

              <button
                onClick={() => {
                  setStatus("idle");
                  setErrorMsg("");
                }}
                className="min-h-11 px-5 bg-slate-800 text-slate-200 rounded-xl text-sm font-medium"
              >
                Try again
              </button>

            </div>
          )}

        </div>

        {/* FOOTER */}

        <p className="text-center text-xs text-slate-700 font-mono mt-4">
          ESP32-Setup · 192.168.4.1
        </p>

      </div>

    </div>
  );
}

// ============================================================
// SIGNAL BARS
// ============================================================

function SignalBars({
  rssi,
}: {
  rssi: number;
}) {

  const bars =
    rssi >= -55
      ? 4
      : rssi >= -65
      ? 3
      : rssi >= -75
      ? 2
      : 1;

  return (

    <span className="flex items-end gap-[2px] h-3 shrink-0">

      {[1, 2, 3, 4].map(
        (index) => (

          <span
            key={index}
            className={`w-[3px] rounded-sm ${
              index <= bars
                ? "bg-cyan-400"
                : "bg-slate-700"
            }`}
            style={{
              height:
                `${index * 25}%`,
            }}
          />

        )
      )}

    </span>
  );
}

// ============================================================
// FETCH WITH TIMEOUT
// ============================================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();

  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new Error(
        `Request timed out after ${timeoutMs / 1000} seconds`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
// ============================================================
// SLEEP
// ============================================================

function sleep(
  milliseconds: number
): Promise<void> {

  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}