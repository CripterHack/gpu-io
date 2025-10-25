[gpu-io](../README.md) / performance

# Namespace: performance

## Table of contents

### Interfaces

- [QualityPreset](../interfaces/performance.QualityPreset.md)
- [AutoProfileOptions](../interfaces/performance.AutoProfileOptions.md)
- [DeviceCapabilities](../interfaces/performance.DeviceCapabilities.md)
- [BrowserEnvironment](../interfaces/performance.BrowserEnvironment.md)

### Type Aliases

- [QualityPresetId](performance.md#qualitypresetid)

### Variables

- [QUALITY\_PRESET\_MAPPING](performance.md#quality_preset_mapping)
- [QUALITY\_PRESETS](performance.md#quality_presets)
- [QUALITY\_SEQUENCE](performance.md#quality_sequence)

### Functions

- [getNextQualityId](performance.md#getnextqualityid)
- [prefersReducedMotion](performance.md#prefersreducedmotion)
- [detectQualityProfile](performance.md#detectqualityprofile)
- [createFluidBackground](performance.md#createfluidbackground)
- [translatePresetToConfig](performance.md#translatepresettoconfig)

## Type Aliases

### QualityPresetId

Ƭ **QualityPresetId**: ``"alto"`` \| ``"medio"`` \| ``"bajo"`` \| ``"minimo"``

## Variables

### QUALITY\_PRESET\_MAPPING

• `Const` **QUALITY\_PRESET\_MAPPING**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `high` | ``"alto"`` |
| `medium` | ``"medio"`` |
| `low` | ``"bajo"`` |
| `minimal` | ``"minimo"`` |

___

### QUALITY\_PRESETS

• `Const` **QUALITY\_PRESETS**: `Record`<[`QualityPresetId`](performance.md#qualitypresetid), [`QualityPreset`](../interfaces/performance.QualityPreset.md)\>

___

### QUALITY\_SEQUENCE

• `Const` **QUALITY\_SEQUENCE**: [`QualityPresetId`](performance.md#qualitypresetid)[]

## Functions

### getNextQualityId

▸ **getNextQualityId**(`id`, `direction?`): [`QualityPresetId`](performance.md#qualitypresetid) \| ``null``

Get the next lower quality preset ID in the sequence

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `id` | [`QualityPresetId`](performance.md#qualitypresetid) | `undefined` |
| `direction` | ``"up"`` \| ``"down"`` | `'down'` |

#### Returns

[`QualityPresetId`](performance.md#qualitypresetid) \| ``null``

___

### prefersReducedMotion

▸ **prefersReducedMotion**(`env?`): `boolean`

Check if user prefers reduced motion (SSR-safe)

#### Parameters

| Name | Type |
| :------ | :------ |
| `env?` | [`BrowserEnvironment`](../interfaces/performance.BrowserEnvironment.md) |

#### Returns

`boolean`

___

### detectQualityProfile

▸ **detectQualityProfile**(`capabilities`, `env?`): [`QualityPresetId`](performance.md#qualitypresetid)

Detect optimal quality profile based on device capabilities

#### Parameters

| Name | Type |
| :------ | :------ |
| `capabilities` | [`DeviceCapabilities`](../interfaces/performance.DeviceCapabilities.md) |
| `env?` | [`BrowserEnvironment`](../interfaces/performance.BrowserEnvironment.md) |

#### Returns

[`QualityPresetId`](performance.md#qualitypresetid)

___

### createFluidBackground

▸ **createFluidBackground**(`gpuioAPI`, `options?`): `Object`

Create fluid background with auto-performance profiling
This is a simplified version focused on the profiling logic

#### Parameters

| Name | Type |
| :------ | :------ |
| `gpuioAPI` | `any` |
| `options` | [`AutoProfileOptions`](../interfaces/performance.AutoProfileOptions.md) |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `dispose` | () => `void` |
| `currentProfile` | [`QualityPresetId`](performance.md#qualitypresetid) |

___

### translatePresetToConfig

▸ **translatePresetToConfig**(`preset`): `Object`

Utility to translate quality preset properties to composer configuration

#### Parameters

| Name | Type |
| :------ | :------ |
| `preset` | [`QualityPreset`](../interfaces/performance.QualityPreset.md) |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `particleCount` | `number` |
| `jacobiIterations` | `number` |
| `renderPasses` | `number` |
| `velocityScale` | `number` |
| `trailFadeRate` | `number` |
