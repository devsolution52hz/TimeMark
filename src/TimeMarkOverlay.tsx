import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { formatDate, formatTime, formatWeekday } from './datetime';

const AMBER = '#F5A623';
const VERIFY_COLOR = 'rgba(255,255,255,0.8)';

export type OverlayProps = {
  name: string;
  date: Date;
  address: string;
  verifyCode: string;
  /** hệ số phóng to thêm (mặc định 1) */
  scale?: number;
};

/** Chữ đen viền trắng bằng SVG — viền stroke thật, mượt tuyệt đối */
function OutlinedName({
  children,
  fontSize,
  outline,
  containerStyle,
}: {
  children: string;
  fontSize: number;
  outline: number;
  containerStyle?: object;
}) {
  const text = children ?? '';
  const width = Math.max(1, text.length) * fontSize * 0.64 + outline * 2;
  const height = fontSize * 1.35 + outline * 2;
  const x = outline;
  const y = fontSize + outline; // baseline

  const common = {
    x,
    y,
    fontSize,
    fontWeight: 'bold' as const,
    fontFamily: 'sans-serif',
  };

  return (
    <View style={containerStyle}>
      <Svg width={width} height={height}>
        {/* Lớp viền trắng (stroke bo tròn) */}
        <SvgText
          {...common}
          fill="#fff"
          stroke="#fff"
          strokeWidth={outline * 2}
          strokeLinejoin="round"
        >
          {text}
        </SvgText>
        {/* Lớp chữ đen ở trên */}
        <SvgText {...common} fill="#000">
          {text}
        </SvgText>
      </Svg>
    </View>
  );
}

export default function TimeMarkOverlay({
  name,
  date,
  address,
  verifyCode,
  scale = 1,
}: OverlayProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Đo bề rộng để giãn "100% Chân thực" khớp đúng bề rộng chữ "Timemark"
  const [logoW, setLogoW] = useState(0);
  const [subW, setSubW] = useState(0);
  const SUB_TEXT = '100% Chân thực';
  const subScaleX = logoW > 0 && subW > 0 ? logoW / subW : 1;

  // 1 đơn vị = 1% chiều rộng khung → cỡ chữ luôn cân đối với mọi kích thước ảnh
  const u = (width || 400) / 100;
  const s = (n: number) => n * u * scale;

  return (
    <View style={styles.fill} pointerEvents="none" onLayout={onLayout}>
      {/* Khối thông tin góc dưới-trái — giới hạn bề ngang để KHÔNG chạm logo */}
      <View
        style={[
          styles.bottomLeft,
          { paddingLeft: s(2.6), paddingRight: s(4), paddingTop: s(4), paddingBottom: s(1.64) },
        ]}
      >
        <OutlinedName
          fontSize={s(6.4)}
          outline={Math.max(1.5, s(0.6))}
          containerStyle={{ marginBottom: s(0.4) }}
        >
          {name}
        </OutlinedName>

        <View style={styles.timeRow}>
          <Text
            style={[
              styles.time,
              {
                fontSize: s(12),
                lineHeight: s(12),
                textShadowRadius: s(1),
                textShadowOffset: { width: 0, height: s(0.3) },
                // Bóp ngang ~78% cho dáng chữ thon cao (kiểu camera chấm công)
                transform: [{ scaleX: 0.78 }],
                transformOrigin: 'left',
              },
            ]}
          >
            {formatTime(date)}
          </Text>
          <View
            style={[
              styles.divider,
              { height: s(9.4), marginLeft: -s(3.2), marginRight: s(2.4), width: s(0.7), marginTop: s(1.25) },
            ]}
          />
          <View style={[styles.dateBlock, { gap: s(3.8), marginTop: s(1.25) }]}>
            <Text style={[styles.dateText, { fontSize: s(3.7), lineHeight: s(3.7), textShadowRadius: s(0.6) }]}>
              {formatDate(date)}
            </Text>
            <Text style={[styles.dateText, { fontSize: s(3.7), lineHeight: s(3.7), textShadowRadius: s(0.6), marginTop: -s(0.5) }]}>
              {formatWeekday(date)}
            </Text>
          </View>
        </View>

        <Text
          style={[styles.address, { fontSize: s(3.7), lineHeight: s(4.6), marginTop: s(1.8), textShadowRadius: s(0.7) }]}
          numberOfLines={2}
        >
          {address}
        </Text>
      </View>

      {/* Mã xác minh: dải dọc mảnh sát mép phải, đọc từ dưới lên */}
      {!!verifyCode && (
        <View style={[styles.rightVertical, { width: s(4.4), transform: [{ translateY: s(12.7) }] }]}>
          <View style={[styles.verifyRow, { width: s(62) }]}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={s(2.0)}
              color={VERIFY_COLOR}
              style={{ marginRight: s(0.8) }}
            />
            <Text style={[styles.verifyCode, { fontSize: s(2.3) }]} numberOfLines={1}>
              {verifyCode}
            </Text>
            <Text style={[styles.verifyLabel, { fontSize: s(2.3) }]} numberOfLines={1}>
              {'  '}Timemark Verified
            </Text>
          </View>
        </View>
      )}

      {/* Logo góc dưới-phải */}
      <View style={[styles.logoBox, { right: s(2.15), bottom: s(1.25) }]}>
        <Text
          style={[styles.logo, { fontSize: s(3.6) }]}
          onLayout={(e) => setLogoW(e.nativeEvent.layout.width)}
        >
          <Text style={{ color: AMBER }}>Time</Text>
          <Text style={{ color: '#fff' }}>mark</Text>
        </Text>
        <Text
          style={[
            styles.logoSub,
            {
              fontSize: s(2.1),
              marginTop: s(0.4),
              transform: [{ scaleX: subScaleX }],
              transformOrigin: 'left',
            },
          ]}
          onLayout={(e) => setSubW(e.nativeEvent.layout.width)}
        >
          {SUB_TEXT}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  bottomLeft: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    maxWidth: '66%',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    color: '#fff',
    fontFamily: 'Oswald_400Regular',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  divider: {
    backgroundColor: AMBER,
    borderRadius: 0,
    alignSelf: 'center',
  },
  dateBlock: { justifyContent: 'center', alignSelf: 'center' },
  dateText: {
    color: '#fff',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    includeFontPadding: false,
  },
  address: {
    color: '#fff',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
  },
  rightVertical: {
    position: 'absolute',
    right: 0,
    top: '5%',
    height: '58%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  verifyCode: {
    color: VERIFY_COLOR,
    fontWeight: '400',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  verifyLabel: {
    color: VERIFY_COLOR,
    fontWeight: '400',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  logoBox: {
    position: 'absolute',
    alignItems: 'flex-start',
  },
  logo: { fontWeight: '700', letterSpacing: 0.2 },
  logoSub: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '400',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
});
