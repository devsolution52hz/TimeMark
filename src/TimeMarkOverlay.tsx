import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { formatDate, formatHour, formatMinute, formatWeekday } from './datetime';

const AMBER = '#F5A623';

export type OverlayProps = {
  name: string;
  date: Date;
  address: string;
  verifyCode: string;
  /** hệ số phóng to thêm (mặc định 1; preview có thể dùng 0.85) */
  scale?: number;
};

/** Chữ đen viền trắng bằng SVG — mượt mà và đúng chất Timemark */
function OutlinedName({
  children,
  fontSize,
  outline,
}: {
  children: string;
  fontSize: number;
  outline: number;
}) {
  const text = children ?? '';
  // Tính toán kích thước SVG dựa trên text (ước lượng)
  const width = Math.max(1, text.length) * fontSize * 0.7 + outline * 2;
  const height = fontSize * 1.4 + outline * 2;
  const x = outline;
  const y = fontSize + outline; // baseline

  return (
    <View style={{ marginBottom: fontSize * 0.1 }}>
      <Svg width={width} height={height}>
        <SvgText
          x={x}
          y={y}
          fontSize={fontSize}
          fontWeight="bold"
          fontFamily="sans-serif"
          fill="#fff"
          stroke="#fff"
          strokeWidth={outline * 2.2}
          strokeLinejoin="round"
        >
          {text}
        </SvgText>
        <SvgText
          x={x}
          y={y}
          fontSize={fontSize}
          fontWeight="bold"
          fontFamily="sans-serif"
          fill="#000"
        >
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

  // 1 đơn vị = 1% chiều rộng khung → cỡ chữ luôn cân đối với mọi kích thước ảnh
  const u = (width || 400) / 100;
  const s = (n: number) => n * u * scale;

  const hourFS = s(12);
  const dateFS = s(3.7);

  // Đo bề rộng logo để scale text "100% Chân thực" cho khớp
  const [logoW, setLogoW] = useState(0);
  const [subW, setSubW] = useState(0);
  const subScaleX = logoW > 0 && subW > 0 ? logoW / subW : 1;

  return (
    <View style={styles.fill} pointerEvents="none" onLayout={onLayout}>
      {/* LỚP PHỦ TỐI Ở ĐÁY (Scrim) */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.45)']}
        style={[styles.scrim, { height: '38%' }]}
      />

      {/* A. Cụm góc dưới-trái (maxWidth 66%, neo bottom:0) */}
      <View style={[styles.bottomLeft, { paddingLeft: s(2.6), paddingBottom: s(3.2) }]}>
        <OutlinedName fontSize={s(5.6)} outline={s(0.6)}>{name}</OutlinedName>

        <View style={styles.timeRow}>
          {/* Số giờ: Oswald, bóp ngang transform scaleX:0.78 */}
          <View style={[styles.hourPart, { width: hourFS * 0.78 * 1.05 }]}>
             <Text
              style={[
                styles.timeText,
                {
                  fontSize: hourFS,
                  lineHeight: hourFS,
                  transform: [{ scaleX: 0.78 }],
                  transformOrigin: 'left',
                },
              ]}
            >
              {formatHour(date)}
            </Text>
          </View>

          {/* Dấu hai chấm tùy chỉnh (2 ô vuông trắng nhỏ xếp dọc) */}
          <View style={[styles.colonWrap, { marginHorizontal: s(1.4) }]}>
            <View style={[styles.colonDot, { width: s(1.45), height: s(1.45), borderRadius: s(0.3) }]} />
            <View style={[styles.colonDot, { width: s(1.45), height: s(1.45), borderRadius: s(0.3), marginTop: s(1.4) }]} />
          </View>

          {/* Số phút */}
          <View style={[styles.hourPart, { width: hourFS * 0.78 * 1.05 }]}>
             <Text
              style={[
                styles.timeText,
                {
                  fontSize: hourFS,
                  lineHeight: hourFS,
                  transform: [{ scaleX: 0.78 }],
                  transformOrigin: 'left',
                },
              ]}
            >
              {formatMinute(date)}
            </Text>
          </View>

          {/* Thanh phân cách dọc: nền #F5A623, vuông 2 đầu, cao bằng số */}
          <View style={[styles.divider, { width: s(0.7), height: s(9.4), marginHorizontal: s(1.8) }]} />

          {/* Cột ngày: column, dòng trên "DD Tháng M,YYYY", dòng dưới weekday */}
          <View style={[styles.dateBlock, { height: s(9.4) }]}>
            <Text style={[styles.dateText, { fontSize: dateFS, lineHeight: dateFS }]}>
              {formatDate(date)}
            </Text>
            <Text style={[styles.dateText, { fontSize: dateFS, lineHeight: dateFS, marginTop: s(2.5) }]}>
              {formatWeekday(date)}
            </Text>
          </View>
        </View>

        {/* Địa chỉ: trắng, fontSize ≈ s(4.3), numberOfLines={2} */}
        <Text
          style={[
            styles.address,
            { fontSize: s(4.3), lineHeight: s(5.4), marginTop: s(2.4) },
          ]}
          numberOfLines={2}
        >
          {address}
        </Text>
      </View>

      {/* B. Cụm mã xác minh (Dải dọc mép phải): xoay -90deg */}
      {!!verifyCode && (
        <View style={styles.rightVertical}>
          <View style={[styles.verifyRow, { transform: [{ rotate: '-90deg' }] }]}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={s(2.0)}
              color="rgba(255,255,255,0.8)"
              style={{ marginRight: s(0.8) }}
            />
            <Text style={[styles.verifyText, { fontSize: s(2.3) }]}>
              {verifyCode} Timemark Verified
            </Text>
          </View>
        </View>
      )}

      {/* C. Logo góc dưới-phải: Time (cam) mark (trắng) + 100% Chân thực */}
      <View style={[styles.logoBox, { right: s(2.4), bottom: s(2.8) }]}>
        <View
          style={styles.logoRow}
          onLayout={e => setLogoW(e.nativeEvent.layout.width)}
        >
          <Text style={[styles.logoText, { fontSize: s(3.6), color: AMBER }]}>Time</Text>
          <Text style={[styles.logoText, { fontSize: s(3.6), color: '#fff' }]}>mark</Text>
        </View>
        <Text
          style={[
            styles.logoSub,
            {
              fontSize: s(2.1),
              marginTop: s(0.4),
              transform: [{ scaleX: subScaleX }],
              transformOrigin: 'left'
            }
          ]}
          onLayout={e => setSubW(e.nativeEvent.layout.width)}
        >
          100% Chân thực
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  scrim: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
  },
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
  hourPart: {
    overflow: 'visible',
  },
  timeText: {
    color: '#fff',
    fontFamily: 'Oswald_400Regular',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  colonWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  colonDot: {
    backgroundColor: '#fff',
  },
  divider: {
    backgroundColor: AMBER,
  },
  dateBlock: {
    justifyContent: 'center',
  },
  dateText: {
    color: '#fff',
    fontWeight: '500', // Medium
    includeFontPadding: false,
  },
  address: {
    color: '#fff',
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  rightVertical: {
    position: 'absolute',
    right: -10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 240,
    justifyContent: 'center',
  },
  verifyText: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '400',
    letterSpacing: 0.4,
  },
  logoBox: {
    position: 'absolute',
    alignItems: 'flex-start',
  },
  logoRow: {
    flexDirection: 'row',
  },
  logoText: {
    fontWeight: '700',
  },
  logoSub: {
    color: '#bfbfbf',
    fontWeight: '400',
  },
});
