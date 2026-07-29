// 设备库状态管理
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { DeviceModel, DeviceCategory, DeviceType } from '@security-survey/shared-types';
import { BUILTIN_DEVICES, deviceLibrary } from '@security-survey/device-lib';

export const useDeviceLibraryStore = defineStore('deviceLibrary', () => {
  // 状态
  const customDevices = ref<DeviceModel[]>([]);
  const selectedCategory = ref<DeviceCategory | 'all'>('all');
  const searchQuery = ref('');
  const selectedDeviceId = ref<string | null>(null);
  const placementMode = ref(false);
  const placementDeviceId = ref<string | null>(null);

  // 计算属性：合并内置+自定义
  const allDevices = computed(() => [
    ...BUILTIN_DEVICES,
    ...customDevices.value,
  ]);

  const filteredDevices = computed(() => {
    let result = allDevices.value;

    if (selectedCategory.value !== 'all') {
      result = result.filter(d => d.category === selectedCategory.value);
    }

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.vendor.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q) ||
        d.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    return result;
  });

  const devicesByCategory = computed(() => {
    const map = new Map<DeviceCategory, DeviceModel[]>();
    for (const device of allDevices.value) {
      const list = map.get(device.category) || [];
      list.push(device);
      map.set(device.category, list);
    }
    return map;
  });

  const categories = computed(() => [
    'all',
    ...Array.from(devicesByCategory.value.keys()).sort(),
  ]);

  const selectedDevice = computed(() => {
    if (!selectedDeviceId.value) return null;
    return allDevices.value.find(d => d.id === selectedDeviceId.value) || null;
  });

  // 动作
  function selectCategory(category: DeviceCategory | 'all') {
    selectedCategory.value = category;
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query;
  }

  function selectDevice(deviceId: string) {
    selectedDeviceId.value = deviceId;
  }

  function startPlacement(deviceId: string) {
    placementMode.value = true;
    placementDeviceId.value = deviceId;
    selectedDeviceId.value = deviceId;
  }

  function stopPlacement() {
    placementMode.value = false;
    placementDeviceId.value = null;
  }

  function addCustomDevice(device: DeviceModel) {
    customDevices.value.push(device);
    saveCustomDevices();
  }

  function updateCustomDevice(id: string, updates: Partial<DeviceModel>) {
    const idx = customDevices.value.findIndex(d => d.id === id);
    if (idx >= 0) {
      customDevices.value[idx] = { ...customDevices.value[idx], ...updates, updatedAt: Date.now() };
      saveCustomDevices();
    }
  }

  function removeCustomDevice(id: string) {
    customDevices.value = customDevices.value.filter(d => d.id !== id);
    saveCustomDevices();
  }

  function importLibrary(json: string) {
    try {
      const devices = JSON.parse(json);
      let success = 0, failed = 0;
      for (const d of devices) {
        if (validateDevice(d)) {
          addCustomDevice(d);
          success++;
        } else {
          failed++;
        }
      }
      return { success, failed };
    } catch {
      return { success: 0, failed: 0, error: 'JSON 解析失败' };
    }
  }

  function exportLibrary(): string {
    return JSON.stringify(customDevices.value, null, 2);
  }

  function validateDevice(obj: any): obj is DeviceModel {
    return !!(
      obj.id && obj.name && obj.vendor && obj.category &&
      obj.type && obj.specs && obj.icon
    );
  }

  function saveCustomDevices() {
    localStorage.setItem('customDevices', JSON.stringify(customDevices.value));
  }

  function loadCustomDevices() {
    const saved = localStorage.getItem('customDevices');
    if (saved) {
      try {
        customDevices.value = JSON.parse(saved);
      } catch { }
    }
  }

  // 初始化
  loadCustomDevices();

  return {
    customDevices,
    selectedCategory,
    searchQuery,
    selectedDeviceId,
    placementMode,
    placementDeviceId,
    allDevices,
    filteredDevices,
    devicesByCategory,
    categories,
    selectedDevice,
    selectCategory,
    setSearchQuery,
    selectDevice,
    startPlacement,
    stopPlacement,
    addCustomDevice,
    updateCustomDevice,
    removeCustomDevice,
    importLibrary,
    exportLibrary,
  };
});