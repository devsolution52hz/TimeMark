import React, { createContext, useContext, useMemo, useState } from 'react';
import { makeVerifyCode } from './datetime';

// Các kiểu màu cho tên hiển thị: chữ + màu viền bao quanh.
export type NameStyle = { key: string; label: string; text: string; outline: string };
export const NAME_STYLES: NameStyle[] = [
  { key: 'classic', label: 'Cổ điển',    text: '#000000', outline: '#FFFFFF' },
  { key: 'red',     label: 'Đỏ',         text: '#FFFFFF', outline: '#E23B3B' },
  { key: 'purple',  label: 'Tím',        text: '#FFFFFF', outline: '#8B43E6' },
  { key: 'orange',  label: 'Vàng cam',   text: '#FFFFFF', outline: '#F5A623' },
  { key: 'green',   label: 'Xanh lá',    text: '#FFFFFF', outline: '#22B14C' },
  { key: 'blue',    label: 'Xanh dương', text: '#FFFFFF', outline: '#2D7FF9' },
];

export type Settings = {
  // Thông tin hiển thị trên dấu TimeMark
  name: string;
  setName: (v: string) => void;
  nameStyleKey: string;
  setNameStyleKey: (v: string) => void;
  getNameStyle: () => NameStyle;

  // Địa chỉ
  manualAddress: string;
  setManualAddress: (v: string) => void;
  gpsAddress: string; // địa chỉ lấy từ GPS (do CameraScreen cập nhật)
  setGpsAddress: (v: string) => void;
  autoAddress: boolean; // true = dùng GPS, false = dùng manualAddress
  setAutoAddress: (v: boolean) => void;

  // Giờ
  useCustomTime: boolean; // true = dùng customDate cố định, false = giờ thực
  setUseCustomTime: (v: boolean) => void;
  customDate: Date;
  setCustomDate: (v: Date) => void;

  // Mã xác minh
  verifyCode: string;
  setVerifyCode: (v: string) => void;
  showVerifyCode: boolean; // true = in mã xác minh lên ảnh
  setShowVerifyCode: (v: boolean) => void;

  // Tiện ích đọc giá trị đang dùng
  getDisplayDate: () => Date; // giờ đang dùng (thực hoặc custom)
  getDisplayAddress: () => string;
};

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState('');
  const [nameStyleKey, setNameStyleKey] = useState('classic');
  const [manualAddress, setManualAddress] = useState('');
  const [gpsAddress, setGpsAddress] = useState('');
  const [autoAddress, setAutoAddress] = useState(true);
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customDate, setCustomDate] = useState(new Date());
  const [verifyCode, setVerifyCode] = useState(makeVerifyCode());
  const [showVerifyCode, setShowVerifyCode] = useState(true);

  const value = useMemo<Settings>(
    () => ({
      name,
      setName,
      nameStyleKey,
      setNameStyleKey,
      getNameStyle: () =>
        NAME_STYLES.find((x) => x.key === nameStyleKey) ?? NAME_STYLES[0],
      manualAddress,
      setManualAddress,
      gpsAddress,
      setGpsAddress,
      autoAddress,
      setAutoAddress,
      useCustomTime,
      setUseCustomTime,
      customDate,
      setCustomDate,
      verifyCode,
      setVerifyCode,
      showVerifyCode,
      setShowVerifyCode,
      getDisplayDate: () => (useCustomTime ? customDate : new Date()),
      getDisplayAddress: () => {
        if (autoAddress && gpsAddress) return gpsAddress;
        return manualAddress;
      },
    }),
    [
      name,
      nameStyleKey,
      manualAddress,
      gpsAddress,
      autoAddress,
      useCustomTime,
      customDate,
      verifyCode,
      showVerifyCode,
    ]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings phải nằm trong <SettingsProvider>');
  return ctx;
}
