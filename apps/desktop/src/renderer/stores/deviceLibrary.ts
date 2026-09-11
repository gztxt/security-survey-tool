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
    // 同步到主进程设备库（导出引擎使用），失败不阻断本地操作
    try { window.api?.device?.addCustom(device); } catch { /* 忽略 */ }
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
      // 批量同步到主进程（以整包导入方式）
      try { window.api?.device?.importLibrary(json); } catch { /* 忽略 */ }
      return { success, failed };
    } catch {
      return { success: 0, failed: 0, error: 'JSON 解析失败' };
    }
  }

  function exportLibrary(): string {
    return JSON.stringify(customDevices.value, null, 2);
  }

  // 统计与兼容 API（仪表盘/设置页使用）
  const builtinCount = computed(() => BUILTIN_DEVICES.length);
  const customCount = computed(() => customDevices.value.length);
  const totalCount = computed(() => builtinCount.value + customCount.value);

  const categoryMeta: Record<string, { name: string; color: string; icon: string }> = {
    camera: { name: '摄像机', color: '#3b82f6', icon: 'VideoCamera' },
    access_control: { name: '门禁', color: '#22c55e', icon: 'Lock' },
    alarm: { name: '报警', color: '#ef4444', icon: 'Bell' },
    intercom: { name: '对讲', color: '#8b5cf6', icon: 'Phone' },
    patrol: { name: '巡更', color: '#f59e0b', icon: 'Position' },
    storage: { name: '存储', color: '#06b6d4', icon: 'Coin' },
    network: { name: '网络', color: '#10b981', icon: 'Connection' },
    display: { name: '显示', color: '#6366f1', icon: 'Monitor' },
    power: { name: '电源', color: '#eab308', icon: 'Lightning' },
    sensor: { name: '传感', color: '#ec4899', icon: 'Odometer' },
    other: { name: '其他', color: '#94a3b8', icon: 'Box' },
  };

  function getCategoriesWithCount() {
    const map = new Map<string, number>();
    for (const d of allDevices.value) {
      map.set(d.category, (map.get(d.category) || 0) + 1);
    }
    return Array.from(map.entries()).map(([category, count]) => {
      const meta = categoryMeta[category] || categoryMeta.other;
      return { id: category, category, count, name: meta.name, color: meta.color, icon: meta.icon };
    });
  }

  /** 从模板（已有设备型号）创建可放置的设备实例 */
  function createDeviceFromTemplate(templateId: string, opts?: { x?: number; y?: number; drawingId?: string }): any {
    const model = allDevices.value.find(d => d.id === templateId);
    if (!model) return null;
    return {
      id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      drawingId: opts?.drawingId || '',
      modelId: model.id,
      position: { x: opts?.x || 0, y: opts?.y || 0 },
      rotation: 0,
      label: model.name,
      mountHeight: 2.5,
      customSpecs: {},
    };
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
    builtinCount,
    customCount,
    totalCount,
    getCategoriesWithCount,
    createDeviceFromTemplate,
  };
});

/** 兼容别名：部分旧视图使用 useDeviceStore 引用设备库 */
export const useDeviceStore = useDeviceLibraryStore;