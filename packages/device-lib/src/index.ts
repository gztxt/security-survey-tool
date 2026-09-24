// 设备库核心模块
// 内置预置设备型号、自定义设备导入导出、FOV 计算

import {
  DeviceModel,
  DeviceInstance,
  DeviceSpecs,
  DeviceCategory,
  DeviceType,
  Point2D,
  FieldOfView,
} from '@security-survey/shared-types';

// ============ 内置设备库（20+ 主流型号）===========

export const BUILTIN_DEVICES: DeviceModel[] = [
  // === 半球机 ===
  {
    id: 'hik-dome-2cd2145fwd',
    name: '海康威视 DS-2CD2145FWD-I',
    vendor: 'Hikvision',
    category: 'dome',
    type: 'fixed_dome',
    specs: {
      focalLength: 2.8,
      horizontalFOV: 103,
      verticalFOV: 55,
      maxDistance: 30,
      minIllumination: 0.01,
      resolution: '4MP',
      compression: ['H.265+', 'H.265', 'H.264+', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 5.5,
      voltage: 'PoE',
      mountHeight: 2.5,
      dimensions: { w: 111, h: 82, d: 82 },
      weight: 380,
      ipRating: 'IP67',
      ikRating: 'IK10',
      audioIn: true,
      audioOut: false,
      alarmIn: 1,
      alarmOut: 1,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'dome-fixed', width: 24, height: 24, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 450,
    description: '400万定焦半球，红外30米，支持H.265+',
    tags: ['hot', 'cost-effective'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'hik-dome-2cd2385fwd',
    name: '海康威视 DS-2CD2385FWD-I',
    vendor: 'Hikvision',
    category: 'dome',
    type: 'varifocal_dome',
    specs: {
      focalLength: [2.8, 12],
      horizontalFOV: 105,
      verticalFOV: 56,
      maxDistance: 40,
      minIllumination: 0.005,
      resolution: '8MP',
      compression: ['H.265+', 'H.265', 'H.264+', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 7.5,
      voltage: 'PoE',
      mountHeight: 3,
      dimensions: { w: 129, h: 98, d: 98 },
      weight: 550,
      ipRating: 'IP67',
      ikRating: 'IK10',
      audioIn: true,
      audioOut: true,
      alarmIn: 1,
      alarmOut: 1,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'dome-varifocal', width: 24, height: 24, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 850,
    description: '800万电动变焦半球，星光级，红外40米',
    tags: ['starlight', 'motorized'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'dh-dome-ipc-hdbw2431r',
    name: '大华 IPC-HDBW2431R-ZS',
    vendor: 'Dahua',
    category: 'dome',
    type: 'motorized_dome',
    specs: {
      focalLength: [2.7, 13.5],
      horizontalFOV: 109,
      verticalFOV: 57,
      maxDistance: 30,
      minIllumination: 0.002,
      resolution: '4MP',
      compression: ['H.265', 'H.264'],
      maxFrameRate: 30,
      powerConsumption: 6.8,
      voltage: 'PoE+',
      mountHeight: 3,
      dimensions: { w: 122, h: 89, d: 89 },
      weight: 480,
      ipRating: 'IP67',
      ikRating: 'IK10',
      audioIn: true,
      audioOut: true,
      alarmIn: 2,
      alarmOut: 1,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'dome-motorized', width: 24, height: 24, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 780,
    description: '400万电动变焦星光级半球，大光圈',
    tags: ['starlight', 'motorized'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // === 枪机 ===
  {
    id: 'hik-bullet-2cd2t45fwd',
    name: '海康威视 DS-2CD2T45FWD-I5',
    vendor: 'Hikvision',
    category: 'bullet',
    type: 'fixed_bullet',
    specs: {
      focalLength: 4,
      horizontalFOV: 84,
      verticalFOV: 45,
      maxDistance: 50,
      minIllumination: 0.01,
      resolution: '4MP',
      compression: ['H.265+', 'H.265', 'H.264+', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 6.5,
      voltage: 'PoE',
      mountHeight: 3.5,
      dimensions: { w: 94, h: 82, d: 266 },
      weight: 650,
      ipRating: 'IP67',
      ikRating: 'IK10',
      audioIn: false,
      audioOut: false,
      alarmIn: 0,
      alarmOut: 0,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'bullet-fixed', width: 24, height: 24, anchor: { x: 0.3, y: 0.5 }, rotationOffset: -Math.PI / 2 },
    price: 420,
    description: '400万定焦枪机，红外50米，性价比高',
    tags: ['hot', 'long-range'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'hik-bullet-2cd2t85fwd',
    name: '海康威视 DS-2CD2T85FWD-I5',
    vendor: 'Hikvision',
    category: 'bullet',
    type: 'varifocal_bullet',
    specs: {
      focalLength: [2.8, 12],
      horizontalFOV: 112,
      verticalFOV: 59,
      maxDistance: 60,
      minIllumination: 0.005,
      resolution: '8MP',
      compression: ['H.265+', 'H.265', 'H.264+', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 9.5,
      voltage: 'PoE+',
      mountHeight: 4,
      dimensions: { w: 105, h: 94, d: 296 },
      weight: 850,
      ipRating: 'IP67',
      ikRating: 'IK10',
      audioIn: true,
      audioOut: true,
      alarmIn: 1,
      alarmOut: 1,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'bullet-varifocal', width: 24, height: 24, anchor: { x: 0.3, y: 0.5 }, rotationOffset: -Math.PI / 2 },
    price: 980,
    description: '800万电动变焦枪机，红外60米',
    tags: ['motorized', 'high-res'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'dh-bullet-ipc-hfw2431s',
    name: '大华 IPC-HFW2431S-S-IL',
    vendor: 'Dahua',
    category: 'bullet',
    type: 'fixed_bullet',
    specs: {
      focalLength: 3.6,
      horizontalFOV: 87,
      verticalFOV: 47,
      maxDistance: 40,
      minIllumination: 0.008,
      resolution: '4MP',
      compression: ['H.265', 'H.264'],
      maxFrameRate: 30,
      powerConsumption: 5.2,
      voltage: 'PoE',
      mountHeight: 3,
      dimensions: { w: 70, h: 70, d: 164 },
      weight: 380,
      ipRating: 'IP67',
      audioIn: false,
      audioOut: false,
      alarmIn: 0,
      alarmOut: 0,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'bullet-fixed', width: 24, height: 24, anchor: { x: 0.3, y: 0.5 }, rotationOffset: -Math.PI / 2 },
    price: 380,
    description: '400万星光级定焦枪机，小体积',
    tags: ['starlight', 'compact'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // === 球机 ===
  {
    id: 'hik-ptz-ds2de4a425iw',
    name: '海康威视 DS-2DE4A425IW-DE',
    vendor: 'Hikvision',
    category: 'ptz',
    type: 'speed_dome',
    specs: {
      focalLength: [4.8, 120],
      horizontalFOV: 58.4,
      verticalFOV: 33.6,
      maxDistance: 100,
      minIllumination: 0.005,
      resolution: '4MP',
      compression: ['H.265+', 'H.265', 'H.264+', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 24,
      voltage: 'Hi-PoE',
      mountHeight: 6,
      dimensions: { w: 220, h: 220, d: 350 },
      weight: 3500,
      ipRating: 'IP66',
      audioIn: true,
      audioOut: true,
      alarmIn: 7,
      alarmOut: 2,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'ptz-speed', width: 28, height: 28, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 3200,
    description: '400万25倍光学变焦高速球，智能跟踪',
    tags: ['ptz', 'tracking', 'high-end'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'dh-ptz-ipc-ptz525',
    name: '大华 SD6AL830U-HNI',
    vendor: 'Dahua',
    category: 'ptz',
    type: 'outdoor_ptz',
    specs: {
      focalLength: [6.0, 180],
      horizontalFOV: 61.2,
      verticalFOV: 35.5,
      maxDistance: 200,
      minIllumination: 0.001,
      resolution: '8MP',
      compression: ['H.265', 'H.264'],
      maxFrameRate: 30,
      powerConsumption: 30,
      voltage: 'Hi-PoE',
      mountHeight: 8,
      dimensions: { w: 240, h: 240, d: 380 },
      weight: 4200,
      ipRating: 'IP67',
      audioIn: true,
      audioOut: true,
      alarmIn: 7,
      alarmOut: 2,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'ptz-outdoor', width: 28, height: 28, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 5800,
    description: '800万30倍光学变焦，星光级，激光补光200米',
    tags: ['ptz', 'laser', '4k'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // === 全景/多目 ===
  {
    id: 'hik-pano-ds2cd6d82f',
    name: '海康威视 DS-2CD6D82F-IVS',
    vendor: 'Hikvision',
    category: 'panoramic',
    type: 'multi_pano',
    specs: {
      focalLength: 2.8,
      horizontalFOV: 180,
      verticalFOV: 90,
      maxDistance: 20,
      minIllumination: 0.01,
      resolution: '8MP×2',
      compression: ['H.265', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 18,
      voltage: 'PoE+',
      mountHeight: 3,
      dimensions: { w: 180, h: 90, d: 90 },
      weight: 1200,
      ipRating: 'IP67',
      audioIn: true,
      audioOut: true,
      alarmIn: 1,
      alarmOut: 1,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'pano-dual', width: 28, height: 24, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 2800,
    description: '双目180°全景拼接，800万×2',
    tags: ['panoramic', '180deg'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'dh-pano-ipc-pfw8800',
    name: '大华 IPC-PFW8800-A180',
    vendor: 'Dahua',
    category: 'panoramic',
    type: 'single_pano',
    specs: {
      focalLength: 1.98,
      horizontalFOV: 180,
      verticalFOV: 180,
      maxDistance: 15,
      minIllumination: 0.01,
      resolution: '12MP',
      compression: ['H.265', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 12,
      voltage: 'PoE+',
      mountHeight: 2.5,
      dimensions: { w: 120, h: 120, d: 60 },
      weight: 800,
      ipRating: 'IP67',
      audioIn: true,
      audioOut: true,
      alarmIn: 2,
      alarmOut: 1,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'pano-fisheye', width: 24, height: 24, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 2200,
    description: '单目鱼眼180°×180°，1200万像素',
    tags: ['fisheye', '360deg'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // === 热成像 ===
  {
    id: 'hik-thermal-ds2td2617',
    name: '海康威视 DS-2TD2617-3/PA',
    vendor: 'Hikvision',
    category: 'thermal',
    type: 'thermal_bullet',
    specs: {
      focalLength: 7,
      horizontalFOV: 25,
      verticalFOV: 19,
      maxDistance: 150,
      minIllumination: 0,
      resolution: '384×288',
      compression: ['H.265', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 8,
      voltage: 'PoE+',
      mountHeight: 4,
      dimensions: { w: 100, h: 100, d: 250 },
      weight: 1200,
      ipRating: 'IP66',
      audioIn: false,
      audioOut: false,
      alarmIn: 1,
      alarmOut: 1,
      sdCardSlot: false,
    },
    icon: { type: 'builtin', path: 'thermal-bullet', width: 24, height: 24, anchor: { x: 0.3, y: 0.5 }, rotationOffset: -Math.PI / 2 },
    price: 8500,
    description: '热成像枪机，384×288，火点检测',
    tags: ['thermal', 'fire-detection'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'hik-bi-thermal-ds2td4237',
    name: '海康威视 DS-2TD4237-10/V2',
    vendor: 'Hikvision',
    category: 'thermal',
    type: 'bi_spectrum',
    specs: {
      focalLength: [6, 240],
      horizontalFOV: 58.4,
      verticalFOV: 33.6,
      maxDistance: 500,
      minIllumination: 0.002,
      resolution: '2MP+384×288',
      compression: ['H.265', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 45,
      voltage: 'AC24V',
      mountHeight: 10,
      dimensions: { w: 300, h: 300, d: 450 },
      weight: 6500,
      ipRating: 'IP66',
      audioIn: true,
      audioOut: true,
      alarmIn: 7,
      alarmOut: 2,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'bi-spectrum', width: 28, height: 28, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 28000,
    description: '双光谱球机，热成像+可见光，激光测距',
    tags: ['bi-spectrum', 'laser', 'perimeter'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // === 门口机/可视对讲 ===
  {
    id: 'hik-door-ds2dv2601',
    name: '海康威视 DS-KV8102-IM',
    vendor: 'Hikvision',
    category: 'door_station',
    type: 'video_door',
    specs: {
      focalLength: 2.1,
      horizontalFOV: 135,
      verticalFOV: 75,
      maxDistance: 3,
      minIllumination: 0.1,
      resolution: '2MP',
      compression: ['H.264'],
      maxFrameRate: 25,
      powerConsumption: 6,
      voltage: 'DC12V/PoE',
      mountHeight: 1.5,
      dimensions: { w: 100, h: 160, d: 25 },
      weight: 300,
      ipRating: 'IP65',
      audioIn: true,
      audioOut: true,
      alarmIn: 2,
      alarmOut: 1,
      sdCardSlot: true,
    },
    icon: { type: 'builtin', path: 'door-station', width: 20, height: 24, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 650,
    description: '二线制可视门口机，人脸识别',
    tags: ['door', 'face-recognition'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // === NVR ===
  {
    id: 'hik-nvr-ds7716ni',
    name: '海康威视 DS-7716NI-K4/16P',
    vendor: 'Hikvision',
    category: 'nvr',
    type: 'nvr_16ch',
    specs: {
      resolution: '16ch@8MP',
      compression: ['H.265+', 'H.265', 'H.264+', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 20,
      voltage: 'DC12V',
      dimensions: { w: 380, h: 52, d: 315 },
      weight: 2500,
      audioIn: true,
      audioOut: true,
      alarmIn: 16,
      alarmOut: 4,
      sdCardSlot: false,
    },
    icon: { type: 'builtin', path: 'nvr', width: 28, height: 20, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 1800,
    description: '16路PoE NVR，4盘位，8MP解码',
    tags: ['nvr', 'poe'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'hik-nvr-ds7732ni',
    name: '海康威视 DS-7732NI-K4/16P',
    vendor: 'Hikvision',
    category: 'nvr',
    type: 'nvr_32ch',
    specs: {
      resolution: '32ch@8MP',
      compression: ['H.265+', 'H.265', 'H.264+', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 25,
      voltage: 'DC12V',
      dimensions: { w: 440, h: 70, d: 380 },
      weight: 4500,
      audioIn: true,
      audioOut: true,
      alarmIn: 16,
      alarmOut: 4,
      sdCardSlot: false,
    },
    icon: { type: 'builtin', path: 'nvr', width: 28, height: 20, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 3200,
    description: '32路NVR，4盘位，支持RAID',
    tags: ['nvr', 'raid', '32ch'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // === PoE 交换机 ===
  {
    id: 'hik-switch-ds3e0310p',
    name: '海康威视 DS-3E0310P-E/M',
    vendor: 'Hikvision',
    category: 'switch',
    type: 'poe_switch_8',
    specs: {
      powerConsumption: 60,
      voltage: 'AC220V',
      dimensions: { w: 160, h: 40, d: 100 },
      weight: 500,
    },
    icon: { type: 'builtin', path: 'switch-poe', width: 24, height: 18, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 350,
    description: '8口百兆PoE交换机，60W',
    tags: ['switch', 'poe', '8port'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'hik-switch-ds3e0524p',
    name: '海康威视 DS-3E0524P-E/M',
    vendor: 'Hikvision',
    category: 'switch',
    type: 'poe_switch_24',
    specs: {
      powerConsumption: 370,
      voltage: 'AC220V',
      dimensions: { w: 440, h: 44, d: 220 },
      weight: 3000,
    },
    icon: { type: 'builtin', path: 'switch-poe', width: 24, height: 18, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 1200,
    description: '24口千兆PoE交换机，370W',
    tags: ['switch', 'poe', '24port', 'gigabit'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'hik-switch-ds3e1326p',
    name: '海康威视 DS-3E1326P-E',
    vendor: 'Hikvision',
    category: 'switch',
    type: 'core_switch',
    specs: {
      powerConsumption: 60,
      voltage: 'AC220V',
      dimensions: { w: 440, h: 44, d: 220 },
      weight: 3500,
    },
    icon: { type: 'builtin', path: 'switch-core', width: 24, height: 18, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 2800,
    description: '24口千兆+2口+2光口 核心交换机',
    tags: ['switch', 'core', 'sfp'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // === 机柜 ===
  {
    id: 'generic-rack-42u',
    name: '标准机柜 42U（弱电机房）',
    vendor: 'Generic',
    category: 'rack',
    type: 'custom',
    specs: {
      powerConsumption: 0,
      voltage: 'AC220V',
      dimensions: { w: 600, h: 2000, d: 800 },
      weight: 120000,
    },
    icon: { type: 'builtin', path: 'rack-42u', width: 28, height: 28, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 2500,
    description: '600×800×2000 标准 19 英寸机柜，放弱电机房/弱电井',
    tags: ['rack', 'cabinet', '42u', '机柜'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'generic-rack-wall-12u',
    name: '壁挂网络机柜 12U',
    vendor: 'Generic',
    category: 'rack',
    type: 'custom',
    specs: {
      powerConsumption: 0,
      voltage: 'AC220V',
      dimensions: { w: 600, h: 600, d: 450 },
      weight: 25000,
    },
    icon: { type: 'builtin', path: 'rack-wall', width: 24, height: 24, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 600,
    description: '楼层弱电间壁挂机柜，装交换机/POE 供电/配线架',
    tags: ['rack', 'wall', '12u', '机柜'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // === 通用/其他 ===
  {
    id: 'generic-dome-2mp',
    name: '通用 200万半球 (ONVIF)',
    vendor: 'Generic',
    category: 'dome',
    type: 'fixed_dome',
    specs: {
      focalLength: 3.6,
      horizontalFOV: 87,
      verticalFOV: 48,
      maxDistance: 20,
      minIllumination: 0.01,
      resolution: '2MP',
      compression: ['H.264'],
      maxFrameRate: 25,
      powerConsumption: 4,
      voltage: 'PoE/DC12V',
      mountHeight: 2.5,
      dimensions: { w: 110, h: 80, d: 80 },
      weight: 300,
      ipRating: 'IP66',
    },
    icon: { type: 'builtin', path: 'dome-generic', width: 24, height: 24, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 200,
    description: '通用ONVIF半球，适配第三方平台',
    tags: ['generic', 'onvif', 'budget'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'generic-bullet-4mp',
    name: '通用 400万枪机 (ONVIF)',
    vendor: 'Generic',
    category: 'bullet',
    type: 'fixed_bullet',
    specs: {
      focalLength: 4,
      horizontalFOV: 84,
      verticalFOV: 45,
      maxDistance: 40,
      minIllumination: 0.01,
      resolution: '4MP',
      compression: ['H.265', 'H.264'],
      maxFrameRate: 25,
      powerConsumption: 5,
      voltage: 'PoE/DC12V',
      mountHeight: 3.5,
      dimensions: { w: 90, h: 80, d: 250 },
      weight: 500,
      ipRating: 'IP66',
    },
    icon: { type: 'builtin', path: 'bullet-generic', width: 24, height: 24, anchor: { x: 0.3, y: 0.5 }, rotationOffset: -Math.PI / 2 },
    price: 280,
    description: '通用ONVIF枪机，高性价比',
    tags: ['generic', 'onvif', 'budget'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// ============ 设备库管理类 ============

export class DeviceLibrary {
  private devices: Map<string, DeviceModel> = new Map();
  private categories: Map<DeviceCategory, DeviceModel[]> = new Map();

  constructor(customDevices: DeviceModel[] = []) {
    // 加载内置设备
    for (const d of BUILTIN_DEVICES) {
      this.devices.set(d.id, d);
    }
    // 加载自定义设备
    for (const d of customDevices) {
      this.devices.set(d.id, d);
    }
    this.rebuildCategories();
  }

  private rebuildCategories(): void {
    this.categories.clear();
    for (const device of this.devices.values()) {
      const list = this.categories.get(device.category) || [];
      list.push(device);
      this.categories.set(device.category, list);
    }
  }

  // ============ 查询接口 ============

  getAll(): DeviceModel[] {
    return Array.from(this.devices.values());
  }

  getById(id: string): DeviceModel | undefined {
    return this.devices.get(id);
  }

  getByCategory(category: DeviceCategory): DeviceModel[] {
    return this.categories.get(category) || [];
  }

  search(query: string): DeviceModel[] {
    const q = query.toLowerCase();
    return this.getAll().filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.vendor.toLowerCase().includes(q) ||
      d.type.toLowerCase().includes(q) ||
      d.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  getCategories(): DeviceCategory[] {
    return Array.from(this.categories.keys());
  }

  // ============ 增删改 ============

  add(device: DeviceModel): void {
    this.devices.set(device.id, device);
    this.rebuildCategories();
  }

  update(id: string, patch: Partial<DeviceModel>): boolean {
    const existing = this.devices.get(id);
    if (!existing) return false;
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    this.devices.set(id, updated);
    this.rebuildCategories();
    return true;
  }

  remove(id: string): boolean {
    const deleted = this.devices.delete(id);
    if (deleted) this.rebuildCategories();
    return deleted;
  }

  // ============ 导入导出 ============

  exportToJson(): string {
    return JSON.stringify(Array.from(this.devices.values()), null, 2);
  }

  importFromJson(json: string): { success: number; failed: number; errors: string[] } {
    let data: any[];
    try {
      data = JSON.parse(json);
    } catch (e) {
      return { success: 0, failed: 0, errors: ['JSON 解析失败'] };
    }

    const errors: string[] = [];
    let success = 0, failed = 0;

    for (const item of data) {
      if (this.validateDevice(item)) {
        this.add(item);
        success++;
      } else {
        failed++;
        errors.push(`无效设备: ${item.name || item.id}`);
      }
    }
    return { success, failed, errors };
  }

  private validateDevice(obj: any): obj is DeviceModel {
    return !!(
      obj.id && obj.name && obj.vendor && obj.category &&
      obj.type && obj.specs && obj.icon
    );
  }

  // ============ 统计 ============

  getStats() {
    const byCategory: Record<string, number> = {};
    for (const [cat, list] of this.categories) {
      byCategory[cat] = list.length;
    }
    return {
      total: this.devices.size,
      byCategory,
      vendors: [...new Set(this.getAll().map(d => d.vendor))],
    };
  }
}

// ============ 视野计算工具 ============

export interface FovCalcResult {
  horizontalRadius: number;  // 水平半径(米)
  verticalRadius: number;    // 垂直半径(米)
  blindZoneRadius: number;   // 盲区半径(米)
  coverageArea: number;      // 覆盖面积(平方米)
  corners: Point2D[];        // 地面投影四角坐标(相对设备位置)
}

/**
 * 计算摄像头地面视野投影
 * @param specs 设备光学规格
 * @param mountHeight 安装高度(米)
 * @param tiltAngle 俯仰角(弧度，向下为正，默认按最佳识别角度计算)
 * @param rotation 水平旋转角(弧度)
 */
export function calculateFieldOfView(
  specs: DeviceSpecs,
  mountHeight: number,
  tiltAngle: number = Math.atan(mountHeight / (specs.maxDistance || 30)), // 默认指向最远识别距离中点
  rotation: number = 0
): FovCalcResult {
  const hFov = (specs.horizontalFOV || 90) * Math.PI / 180;
  const vFov = (specs.verticalFOV || 50) * Math.PI / 180;
  const maxDist = specs.maxDistance || 30;

  // 简化模型：摄像头视野锥体与地面相交
  // 实际应考虑畸变、镜头畸变校正，这里用针孔模型近似

  // 计算锥体边缘射线与地面交点
  // 垂直方向：上边缘角度 = tilt - vFov/2，下边缘 = tilt + vFov/2
  const upperAngle = tiltAngle - vFov / 2;
  const lowerAngle = tiltAngle + vFov / 2;

  // 上边缘交点距离
  const upperDist = upperAngle > 0 ? mountHeight / Math.tan(upperAngle) : maxDist;
  // 下边缘交点距离（盲区边界）
  const lowerDist = lowerAngle > 0 ? mountHeight / Math.tan(lowerAngle) : 0;

  // 水平方向：左右边缘
  const halfHFov = hFov / 2;
  const leftDist = Math.max(upperDist, lowerDist);
  const rightDist = leftDist;

  // 近距离盲区（下边缘交点到设备垂足的距离）
  const blindZoneRadius = lowerDist;

  // 四角坐标（设备为原点，X轴向右，Y轴向下）
  const halfWidthNear = Math.tan(halfHFov) * Math.max(lowerDist, 0.1);
  const halfWidthFar = Math.tan(halfHFov) * upperDist;

  const corners: Point2D[] = [
    { x: -halfWidthNear, y: lowerDist },      // 左近
    { x: halfWidthNear, y: lowerDist },       // 右近
    { x: halfWidthFar, y: upperDist },        // 右远
    { x: -halfWidthFar, y: upperDist },       // 左远
  ];

  // 旋转
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rotatedCorners = corners.map(p => ({
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  }));

  // 覆盖面积（梯形近似）
  const coverageArea = (halfWidthNear + halfWidthFar) * (upperDist - lowerDist);

  return {
    horizontalRadius: halfWidthFar,
    verticalRadius: upperDist,
    blindZoneRadius: blindZoneRadius,
    coverageArea,
    corners: rotatedCorners,
  };
}

/**
 * 生成视野多边形（用于 Canvas 绘制）
 */
export function generateFovPolygon(
  device: DeviceInstance,
  mountHeight?: number
): Point2D[] {
  const model = BUILTIN_DEVICES.find(d => d.id === device.modelId);
  if (!model) return [];

  const height = mountHeight || device.mountHeight || model.specs.mountHeight || 3;
  const result = calculateFieldOfView(
    device.customSpecs || model.specs,
    height,
    0, // tiltAngle 可后续扩展为设备属性
    device.rotation
  );

  // 转换为世界坐标
  return result.corners.map(c => ({
    x: device.position.x + c.x,
    y: device.position.y + c.y,
  }));
}

/**
 * 判断点是否在视野多边形内
 */
export function isPointInFov(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * 计算多设备视野重叠区域（用于盲区分析）
 */
export function calculateOverlapZones(
  polygons: Map<string, Point2D[]>,
  gridSize: number = 1
): { covered: number; overlap: Map<string, number> } {
  // 网格采样法估算覆盖情况
  // 实际项目中可用更精确的多边形布尔运算库
  const allPoints: Point2D[] = [];
  for (const poly of polygons.values()) allPoints.push(...poly);

  if (allPoints.length === 0) return { covered: 0, overlap: new Map() };

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of allPoints) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  let covered = 0;
  const overlap = new Map<string, number>();

  for (let x = minX; x <= maxX; x += gridSize) {
    for (let y = minY; y <= maxY; y += gridSize) {
      const count = Array.from(polygons.entries()).filter(([_, poly]) =>
        isPointInFov({ x, y }, poly)
      ).length;

      if (count > 0) covered++;
      if (count > 1) {
        const key = `${Math.round(x)}-${Math.round(y)}`;
        overlap.set(key, count);
      }
    }
  }

  return { covered, overlap };
}

// ============ 单例导出 ============

export const deviceLibrary = new DeviceLibrary();
