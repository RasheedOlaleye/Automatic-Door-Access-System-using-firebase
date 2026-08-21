// app/setup/useProvisioning.ts
import { useState, useCallback } from "react";

const ESP32_BASE_URL = "http://192.168.4.1";

export interface WifiNetwork {
  ssid: string;
  rssi: number;
  signalPercent: number;
  secure: boolean;
}

type Step = "connect" | "scanning" | "select" | "connecting" | "success" | "error";

export function useProvisioning() {
  const [step, setStep] = useState<Step>("connect");
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const checkDeviceReachable = useCallback(async () => {
    try {
      const res = await fetch(`${ESP32_BASE_URL}/api/status`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error("Device not responding");
      const data = await res.json();
      setDeviceId(data.deviceId);
      return true;
    } catch {
      setError("Couldn't reach the device. Make sure you're connected to its Wi-Fi network.");
      return false;
    }
  }, []);

  const scanNetworks = useCallback(async (pin: string) => {
    setStep("scanning");
    setError(null);
    try {
      const res = await fetch(`${ESP32_BASE_URL}/api/scan`, {
        headers: { "X-Provisioning-PIN": pin },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 401) throw new Error("Incorrect setup PIN.");
      if (!res.ok) throw new Error("Scan failed.");
      const data = await res.json();
      const sorted = [...data.networks].sort((a, b) => b.rssi - a.rssi);
      setNetworks(sorted);
      setStep("select");
    } catch (e: any) {
      setError(e.message ?? "Failed to scan networks.");
      setStep("error");
    }
  }, []);

  const submitCredentials = useCallback(
    async (ssid: string, password: string, pin: string) => {
      setStep("connecting");
      setError(null);
      try {
        const res = await fetch(`${ESP32_BASE_URL}/api/configure`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Provisioning-PIN": pin,
          },
          body: JSON.stringify({ ssid, password }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 401) throw new Error("Incorrect setup PIN.");
        if (!res.ok) throw new Error("Failed to send configuration.");
        setStep("success");
      } catch (e: any) {
        setError(e.message ?? "Failed to configure device.");
        setStep("error");
      }
    },
    []
  );

  const retry = useCallback(() => {
    setError(null);
    setStep("connect");
  }, []);

  return {
    step, setStep, networks, error, deviceId,
    checkDeviceReachable, scanNetworks, submitCredentials, retry,
  };
}