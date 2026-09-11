<template>
  <div class="device-form" @submit.prevent="handleSubmit">
    <div class="form-grid">
      <!-- 基本信息 -->
      <div class="form-section">
        <h4 class="section-title">基本信息</h4>

        <div class="form-group">
          <label class="form-label">设备名称 <span class="required">*</span></label>
          <input
            class="form-input"
            v-model="form.name"
            placeholder="如：400万红外半球摄像机"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">厂商 <span class="required">*</span></label>
          <input
            class="form-input"
            v-model="form.vendor"
            placeholder="如：Hikvision, Dahua, Uniview"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">型号 <span class="required">*</span></label>
          <input
            class="form-input"
            v-model="form.model"
            placeholder="如：DS-2CD3T46WD-I5"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">分类 <span class="required">*</span></label>
          <select class="form-input" v-model="form.category" required>
            <option value="camera">摄像机</option>
            <option value="nvr">NVR</option>
            <option value="switch">交换机</option>
            <option value="fiber">光纤设备</option>
            <option value="power">电源设备</option>
            <option value="sensor">传感器</option>
            <option value="alarm">报警设备</option>
            <option value="access">门禁设备</option>
            <option value="other">其他</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">类型</label>
          <input
            class="form-input"
            v-model="form.type"
            placeholder="如：红外半球、枪机、球机"
          />
        </div>
      </div>

      <!-- 规格参数 -->
      <div class="form-section">
        <h4 class="section-title">核心规格</h4>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">分辨率</label>
            <select class="form-input" v-model="form.specs.resolution">
              <option value="">请选择</option>
              <option value="1920x1080">1080P (1920x1080)</option>
              <option value="2560x1440">2K (2560x1440)</option>
              <option value="2688x1520">400万 (2688x1520)</option>
              <option value="3840x2160">4K/800万 (3840x2160)</option>
              <option value="5120x2880">1200万</option>
              <option value="custom">自定义...</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">水平视场角</label>
            <input
              class="form-input"
              type="number"
              v-model.number="form.specs.horizontalFOV"
              placeholder="°"
              min="0"
              max="360"
              step="0.1"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">最远识别距离</label>
            <input
              class="form-input"
              type="number"
              v-model.number="form.specs.maxDistance"
              placeholder="米"
              min="0"
              step="1"
            />
          </div>

          <div class="form-group">
            <label class="form-label">最低照度</label>
            <input
              class="form-input"
              v-model="form.specs.minIllumination"
              placeholder="如：0.01 Lux @ F1.2"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">红外距离</label>
            <input
              class="form-input"
              type="number"
              v-model.number="form.specs.irDistance"
              placeholder="米"
              min="0"
              step="1"
            />
          </div>

          <div class="form-group">
            <label class="form-label">镜头焦距</label>
            <input
              class="form-input"
              v-model="form.specs.focalLength"
              placeholder="如：2.8-12mm 或 4mm"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">供电方式</label>
            <select class="form-input" v-model="form.specs.powerSupply">
              <option value="">请选择</option>
              <option value="PoE">PoE (802.3af/at)</option>
              <option value="DC12V">DC 12V</option>
              <option value="DC24V">DC 24V</option>
              <option value="AC220V">AC 220V</option>
              <option value="Solar">太阳能</option>
              <option value="Battery">电池</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">功耗</label>
            <input
              class="form-input"
              type="number"
              v-model.number="form.specs.powerConsumption"
              placeholder="瓦特"
              min="0"
              step="0.1"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">防护等级</label>
            <select class="form-input" v-model="form.specs.protectionLevel">
              <option value="">请选择</option>
              <option value="IP66">IP66</option>
              <option value="IP67">IP67</option>
              <option value="IP68">IP68</option>
              <option value="IK10">IK10 (防暴)</option>
              <option value="IP66+IK10">IP66 + IK10</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">工作温度</label>
            <input
              class="form-input"
              v-model="form.specs.operatingTemperature"
              placeholder="如：-30°C ~ +60°C"
            />
          </div>
        </div>
      </div>

      <!-- 智能功能 -->
      <div class="form-section">
        <h4 class="section-title">智能功能</h4>
        <div class="form-group">
          <label class="form-label">支持功能</label>
          <div class="tags-input">
            <span
              class="tag"
              v-for="tag in form.specs.aiFeatures"
              :key="tag"
            >
              {{ tag }}
              <button type="button" class="tag-remove" @click="removeTag('aiFeatures', tag)">×</button>
            </span>
            <input
              class="form-input tag-input"
              v-model="newAiFeature"
              @keyup.enter="addTag('aiFeatures', newAiFeature)"
              placeholder="输入功能名回车添加..."
            />
          </div>
          <p class="form-hint">如：人脸识别、周界防范、越界侦测、人数统计、车牌识别、烟火检测...</p>
        </div>
      </div>

      <!-- 物理尺寸与价格 -->
      <div class="form-section">
        <h4 class="section-title">尺寸与价格</h4>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">尺寸 (直径×高/长×宽×高)</label>
            <input
              class="form-input"
              v-model="form.specs.dimensions"
              placeholder="如：Ø110×85mm"
            />
          </div>

          <div class="form-group">
            <label class="form-label">重量</label>
            <input
              class="form-input"
              type="number"
              v-model.number="form.specs.weight"
              placeholder="kg"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">参考价格</label>
            <input
              class="form-input"
              type="number"
              v-model.number="form.price"
              placeholder="元"
              min="0"
              step="1"
            />
          </div>

          <div class="form-group">
            <label class="form-label">货币单位</label>
            <select class="form-input" v-model="form.currency">
              <option value="CNY">¥ (人民币)</option>
              <option value="USD">$ (美元)</option>
              <option value="EUR">€ (欧元)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 图标设置 -->
      <div class="form-section">
        <h4 class="section-title">图标设置</h4>

        <div class="form-group">
          <label class="form-label">图标类型</label>
          <select class="form-input" v-model="form.iconType" @change="onIconTypeChange">
            <option value="builtin">内置分类图标</option>
            <option value="lucide">Lucide 图标库</option>
            <option value="svg">自定义 SVG</option>
          </select>
        </div>

        <div class="form-group" v-if="form.iconType === 'lucide'">
          <label class="form-label">Lucide 图标名</label>
          <input
            class="form-input"
            v-model="form.iconLucide"
            placeholder="如：camera, wifi, shield, server..."
          />
          <p class="form-hint">参考 <a href="https://lucide.dev/icons/" target="_blank">lucide.dev/icons</a></p>
        </div>

        <div class="form-group" v-if="form.iconType === 'svg'">
          <label class="form-label">SVG 代码</label>
          <textarea
            class="form-input form-textarea"
            v-model="form.iconSvg"
            rows="6"
            placeholder="粘贴 SVG 代码（不含 <svg> 标签，仅内部 path 等）"
          ></textarea>
        </div>

        <div class="form-group" v-if="form.iconType === 'builtin'">
          <label class="form-label">预览</label>
          <DeviceIcon :device="previewDevice" :size="48" />
        </div>
      </div>

      <!-- 备注 -->
      <div class="form-section">
        <h4 class="section-title">备注</h4>
        <textarea
          class="form-input form-textarea"
          v-model="form.description"
          rows="4"
          placeholder="设备描述、安装注意事项等..."
        ></textarea>
      </div>

      <!-- 标签 -->
      <div class="form-section">
        <h4 class="section-title">标签</h4>
        <div class="tags-input">
          <span
            class="tag"
            v-for="tag in form.tags"
            :key="tag"
          >
            {{ tag }}
            <button type="button" class="tag-remove" @click="removeTag('tags', tag)">×</button>
          </span>
          <input
            class="form-input tag-input"
            v-model="newTag"
            @keyup.enter="addTag('tags', newTag)"
            placeholder="输入标签回车添加..."
          />
        </div>
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')">取消</button>
      <button type="submit" class="btn btn-primary">{{ isEditing ? '更新' : '创建' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import DeviceIcon from './DeviceIcon.vue';

const props = defineProps<{
  device?: any | null;
  models?: any[];
}>();

const emit = defineEmits<{
  save: [device: any];
  cancel: [];
}>();

const isEditing = computed(() => !!props.device);

const form = ref({
  id: '',
  name: '',
  vendor: '',
  model: '',
  category: 'camera',
  type: '',
  specs: {
    resolution: '',
    horizontalFOV: 90,
    maxDistance: 30,
    minIllumination: '',
    irDistance: 30,
    focalLength: '',
    powerSupply: 'PoE',
    powerConsumption: 8,
    protectionLevel: 'IP67',
    operatingTemperature: '-30°C ~ +60°C',
    dimensions: '',
    weight: 0,
    aiFeatures: [] as string[],
  },
  price: 0,
  currency: 'CNY',
  iconType: 'builtin' as 'builtin' | 'lucide' | 'svg',
  iconLucide: '',
  iconSvg: '',
  description: '',
  tags: [] as string[],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const newAiFeature = ref('');
const newTag = ref('');

const previewDevice = computed(() => ({
  id: 'preview',
  name: form.value.name || '预览',
  vendor: form.value.vendor,
  category: form.value.category,
  type: form.value.type,
  icon: form.value.iconType === 'lucide' ? { lucide: form.value.iconLucide, type: 'lucide' }
    : form.value.iconType === 'svg' ? { svg: form.value.iconSvg, type: 'svg' }
    : undefined,
}));

const lucideIcons = [
  'camera', 'video', 'monitor', 'server', 'cpu', 'hard-drive', 'database',
  'wifi', 'radio', 'zap', 'shield', 'lock', 'key', 'unlock',
  'box', 'package', 'truck', 'palette', 'layers', 'git-branch',
  'eye', 'scan', 'search', 'target', 'crosshair', 'zoom-in',
  'mic', 'speaker', 'volume-2', 'headphones', 'music',
  'thermometer', 'droplet', 'wind', 'cloud', 'sun', 'moon',
  'alert-triangle', 'alert-circle', 'bell', 'message-square', 'mail',
  'user', 'users', 'user-check', 'user-plus', 'id-card',
  'credit-card', 'dollar-sign', 'coins', 'receipt', 'shopping-cart',
];

function onMounted(() => {
  if (props.device) {
    form.value = {
      ...form.value,
      ...props.device,
      specs: { ...form.value.specs, ...props.device.specs },
      iconType: props.device.icon?.type || 'builtin',
      iconLucide: props.device.icon?.lucide || '',
      iconSvg: props.device.icon?.svg || '',
    };
  }
});

function onIconTypeChange() {
  if (form.value.iconType === 'builtin') {
    form.value.iconLucide = '';
    form.value.iconSvg = '';
  }
}

function addTag(field: 'aiFeatures' | 'tags', value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  if (!form.value.specs.aiFeatures.includes(trimmed) && field === 'aiFeatures') {
    form.value.specs.aiFeatures.push(trimmed);
  }
  if (!form.value.tags.includes(trimmed) && field === 'tags') {
    form.value.tags.push(trimmed);
  }
  if (field === 'aiFeatures') newAiFeature.value = '';
  if (field === 'tags') newTag.value = '';
}

function removeTag(field: 'aiFeatures' | 'tags', value: string) {
  if (field === 'aiFeatures') {
    form.value.specs.aiFeatures = form.value.specs.aiFeatures.filter(t => t !== value);
  }
  if (field === 'tags') {
    form.value.tags = form.value.tags.filter(t => t !== value);
  }
}

function handleSubmit() {
  const deviceData = {
    ...form.value,
    icon: form.value.iconType === 'builtin' ? undefined
      : form.value.iconType === 'lucide' ? { type: 'lucide', lucide: form.value.iconLucide }
      : { type: 'svg', svg: form.value.iconSvg },
    updatedAt: Date.now(),
  };
  emit('save', deviceData);
}
</script>

<style scoped>
.device-form {
  padding: 16px;
  max-height: 70vh;
  overflow-y: auto;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.form-section {
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 16px;
}

.section-title {
  margin: 0 0 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.required {
  color: #ef4444;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  transition: all 0.15s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.form-input::placeholder {
  color: var(--text-tertiary);
}

.form-textarea {
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--text-tertiary);
}

.form-hint a { color: #3b82f6; }

/* Tags Input */
.tags-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 36px;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: inherit;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 0;
}

.tag-remove:hover {
  background: rgba(59, 130, 246, 0.25);
}

.tag-input {
  flex: 1;
  min-width: 120px;
  padding: 4px 8px !important;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  font-size: 12px !important;
}

.tag-input:focus {
  outline: none;
  box-shadow: none !important;
}

/* Form Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
  margin-top: 16px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--border-color);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>