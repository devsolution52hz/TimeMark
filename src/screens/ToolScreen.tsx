import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatDate, formatTime, makeVerifyCode } from '../datetime';
import { NAME_STYLES, useSettings } from '../SettingsContext';
import TimeMarkOverlay from '../TimeMarkOverlay';

export default function ToolScreen() {
  const s = useSettings();
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Công cụ TimeMark</Text>
      <Text style={styles.hint}>
        Chỉnh thông tin hiển thị trên dấu. Áp dụng cho cả tab Ảnh và Sửa ảnh.
      </Text>

      {/* Xem trước */}
      <Text style={styles.section}>Xem trước</Text>
      <View style={styles.preview}>
        <TimeMarkOverlay
          name={s.name}
          date={s.getDisplayDate()}
          address={s.getDisplayAddress()}
          verifyCode={s.showVerifyCode ? s.verifyCode : ''}
          nameTextColor={s.getNameStyle().text}
          nameOutlineColor={s.getNameStyle().outline}
          scale={0.85}
        />
      </View>

      {/* Giờ */}
      <Text style={styles.section}>Giờ hiển thị</Text>
      <Row label="Dùng giờ tuỳ chỉnh">
        <Switch
          value={s.useCustomTime}
          onValueChange={s.setUseCustomTime}
          trackColor={{ true: '#F5A623' }}
        />
      </Row>

      {s.useCustomTime ? (
        <View style={styles.timeBtns}>
          <Pressable style={styles.timeBtn} onPress={() => setShowDate(true)}>
            <Text style={styles.timeBtnLabel}>Ngày</Text>
            <Text style={styles.timeBtnValue}>{formatDate(s.customDate)}</Text>
          </Pressable>
          <Pressable style={styles.timeBtn} onPress={() => setShowTime(true)}>
            <Text style={styles.timeBtnLabel}>Giờ</Text>
            <Text style={styles.timeBtnValue}>{formatTime(s.customDate)}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.note}>Đang dùng giờ thực của máy (chạy realtime).</Text>
      )}

      {showDate && (
        <DateTimePicker
          value={s.customDate}
          mode="date"
          onChange={(_, d) => {
            setShowDate(Platform.OS === 'ios');
            if (d) s.setCustomDate(mergeDate(s.customDate, d, 'date'));
          }}
        />
      )}
      {showTime && (
        <DateTimePicker
          value={s.customDate}
          mode="time"
          is24Hour
          onChange={(_, d) => {
            setShowTime(Platform.OS === 'ios');
            if (d) s.setCustomDate(mergeDate(s.customDate, d, 'time'));
          }}
        />
      )}

      {/* Tên */}
      <Text style={styles.section}>Tên hiển thị</Text>
      <TextInput
        style={styles.input}
        value={s.name}
        onChangeText={s.setName}
        placeholder="Tên của bạn"
        placeholderTextColor="#666"
      />

      <Text style={styles.subLabel}>Kiểu chữ tên</Text>
      <View style={styles.swatchRow}>
        {NAME_STYLES.map((st) => {
          const active = s.nameStyleKey === st.key;
          return (
            <Pressable
              key={st.key}
              style={styles.swatchItem}
              onPress={() => s.setNameStyleKey(st.key)}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: st.outline, borderColor: active ? '#fff' : '#333' },
                  active && styles.swatchActive,
                ]}
              >
                <Text style={[styles.swatchAa, { color: st.text }]}>Aa</Text>
              </View>
              <Text style={[styles.swatchLabel, active && styles.swatchLabelActive]}>
                {st.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Địa chỉ */}
      <Text style={styles.section}>Địa chỉ</Text>
      <Row label="Tự động lấy từ GPS">
        <Switch
          value={s.autoAddress}
          onValueChange={s.setAutoAddress}
          trackColor={{ true: '#F5A623' }}
        />
      </Row>
      {s.autoAddress ? (
        <Text style={styles.note}>
          {s.gpsAddress
            ? `GPS: ${s.gpsAddress}`
            : 'Chưa có vị trí — mở tab Ảnh để app lấy GPS.'}
        </Text>
      ) : (
        <TextInput
          style={styles.input}
          value={s.manualAddress}
          onChangeText={s.setManualAddress}
          placeholder="Nhập địa chỉ"
          placeholderTextColor="#666"
        />
      )}

      {/* Mã xác minh */}
      <Text style={styles.section}>Mã xác minh</Text>
      <Row label="Hiện mã trên ảnh">
        <Switch
          value={s.showVerifyCode}
          onValueChange={s.setShowVerifyCode}
          trackColor={{ true: '#F5A623' }}
        />
      </Row>
      {s.showVerifyCode ? (
        <View style={[styles.codeRow, { marginTop: 8 }]}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={s.verifyCode}
            onChangeText={s.setVerifyCode}
            autoCapitalize="characters"
          />
          <Pressable
            style={styles.codeBtn}
            onPress={() => s.setVerifyCode(makeVerifyCode())}
          >
            <Text style={styles.codeBtnText}>Tạo mới</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.note}>Ảnh sẽ không in mã xác minh.</Text>
      )}
    </ScrollView>
  );
}

function mergeDate(base: Date, picked: Date, kind: 'date' | 'time'): Date {
  const d = new Date(base);
  if (kind === 'date') {
    d.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  } else {
    d.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  }
  return d;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 16, paddingBottom: 60 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  hint: { color: '#aaa', fontSize: 13, marginTop: 4, marginBottom: 8 },
  section: {
    color: '#F5A623',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  preview: {
    height: 200,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLabel: { color: '#fff', fontSize: 15 },
  note: { color: '#888', fontSize: 13, marginTop: 4 },
  timeBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  timeBtn: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 12,
  },
  timeBtnLabel: { color: '#888', fontSize: 12 },
  timeBtnValue: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: '#222',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 4,
  },
  subLabel: { color: '#aaa', fontSize: 13, marginTop: 12, marginBottom: 8 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatchItem: { alignItems: 'center', width: 52 },
  swatch: {
    width: 44, height: 44, borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  swatchActive: { borderWidth: 3 },
  swatchAa: { fontSize: 16, fontWeight: '800' },
  swatchLabel: { color: '#888', fontSize: 11, marginTop: 4, textAlign: 'center' },
  swatchLabelActive: { color: '#fff', fontWeight: '700' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeBtn: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  codeBtnText: { color: '#F5A623', fontWeight: '700' },
});
