[gpu-io](../README.md) / [performance](../modules/performance.md) / AutoProfileOptions

# Interface: AutoProfileOptions

[performance](../modules/performance.md).AutoProfileOptions

## Table of contents

### Properties

- [profileId](performance.AutoProfileOptions.md#profileid)
- [onRequestDowngrade](performance.AutoProfileOptions.md#onrequestdowngrade)
- [deviceCapabilities](performance.AutoProfileOptions.md#devicecapabilities)
- [onPerformanceUpdate](performance.AutoProfileOptions.md#onperformanceupdate)
- [onCanvasResize](performance.AutoProfileOptions.md#oncanvasresize)

## Properties

### profileId

• `Optional` **profileId**: [`QualityPresetId`](../modules/performance.md#qualitypresetid)

Override automatic detection with specific profile

___

### onRequestDowngrade

• `Optional` **onRequestDowngrade**: (`targetProfileId`: [`QualityPresetId`](../modules/performance.md#qualitypresetid)) => `void`

#### Type declaration

▸ (`targetProfileId`): `void`

Callback when performance downgrade is requested

##### Parameters

| Name | Type |
| :------ | :------ |
| `targetProfileId` | [`QualityPresetId`](../modules/performance.md#qualitypresetid) |

##### Returns

`void`

___

### deviceCapabilities

• `Optional` **deviceCapabilities**: [`DeviceCapabilities`](performance.DeviceCapabilities.md)

Custom device capabilities for testing

___

### onPerformanceUpdate

• `Optional` **onPerformanceUpdate**: (`metrics`: { `fps`: `number` ; `numTicks`: `number` ; `timestamp`: `number` ; `canvasWidth`: `number` ; `canvasHeight`: `number`  }) => `void`

#### Type declaration

▸ (`metrics`): `void`

Callback for performance metrics updates

##### Parameters

| Name | Type |
| :------ | :------ |
| `metrics` | `Object` |
| `metrics.fps` | `number` |
| `metrics.numTicks` | `number` |
| `metrics.timestamp` | `number` |
| `metrics.canvasWidth` | `number` |
| `metrics.canvasHeight` | `number` |

##### Returns

`void`

___

### onCanvasResize

• `Optional` **onCanvasResize**: (`width`: `number`, `height`: `number`) => `void`

#### Type declaration

▸ (`width`, `height`): `void`

Callback for canvas resize events

##### Parameters

| Name | Type |
| :------ | :------ |
| `width` | `number` |
| `height` | `number` |

##### Returns

`void`
