import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate, formatTime, formatWeekday } from './datetime';

const AMBER = '#F5A623';

export type OverlayProps = {
  name: string;
  date: Date;
  address: string;
  verifyCode: string;
  scale?: number;
};

export default function TimeMarkOverlay({
  name,
  date,
  address,
  verifyCode,
  scale = 1,
}: OverlayProps) {
  const s = (n: number) => n * scale;

  return (
    <View style={styles.fill} pointerEvents="none">
      {/* Thông tin góc dưới-trái */}
      <View style={[styles.bottomLeft, { padding: s(16), paddingRight: s(20) }]}>
        <Text
          style={[styles.name, { fontSize: s(30), textShadowRadius: s(8) }]}
          numberOfLines={1}
        >
          {name}
        </Text>

        <View style={styles.timeRow}>
          <Text style={[styles.time, { fontSize: s(52) }]}>
            {formatTime(date)}
          </Text>
          <View style={[styles.divider, { height: s(46), marginHorizontal: s(10), width: s(3) }]} />
          <View style={styles.dateBlock}>
            <Text style={[styles.dateText, { fontSize: s(17) }]}>
              {formatDate(date)}
            </Text>
            <Text style={[styles.dateText, { fontSize: s(17) }]}>
              {formatWeekday(date)}
            </Text>
          </View>
        </View>

        <Text style={[styles.address, { fontSize: s(16), marginTop: s(6) }]}>
          {address}
        </Text>
      </View>

      {/* Mã xác minh dọc bên phải — chỉ hiện khi có giá trị (ảnh đã chụp) */}
      {!!verifyCode && (
        <View style={[styles.rightVertical, { right: s(4) }]}>
          <Text style={[styles.verifyText, { fontSize: s(13) }]}>
            {'© '}{verifyCode}{'  '}Timemark Verified
          </Text>
        </View>
      )}

      {/* Logo góc dưới-phải */}
      <View style={[styles.logoBox, { right: s(14), bottom: s(14) }]}>
        <Text style={[styles.logo, { fontSize: s(22) }]}>
          <Text style={{ color: AMBER }}>Time</Text>
          <Text style={{ color: '#fff' }}>mark</Text>
        </Text>
        <Text style={[styles.logoSub, { fontSize: s(12) }]}>100% Chân thực</Text>
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
    maxWidth: '75%',
  },
  name: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  time: {
    color: '#fff',
    fontWeight: '800',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
  divider: {
    backgroundColor: AMBER,
    borderRadius: 2,
  },
  dateBlock: { justifyContent: 'center' },
  dateText: {
    color: '#fff',
    fontWeight: '600',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  address: {
    color: '#fff',
    fontWeight: '500',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  rightVertical: {
    position: 'absolute',
    top: '38%',
    transform: [{ rotate: '90deg' }],
  },
  verifyText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '400',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  logoBox: {
    position: 'absolute',
    alignItems: 'flex-end',
  },
  logo: { fontWeight: '800' },
  logoSub: {
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});
