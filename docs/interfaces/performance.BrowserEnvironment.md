[gpu-io](../README.md) / [performance](../modules/performance.md) / BrowserEnvironment

# Interface: BrowserEnvironment

[performance](../modules/performance.md).BrowserEnvironment

## Table of contents

### Properties

- [window](performance.BrowserEnvironment.md#window)
- [navigator](performance.BrowserEnvironment.md#navigator)

## Properties

### window

• `Optional` **window**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `matchMedia?` | (`query`: `string`) => `MediaQueryList` |
| `devicePixelRatio?` | `number` |
| `innerWidth?` | `number` |
| `innerHeight?` | `number` |

___

### navigator

• `Optional` **navigator**: { `deviceMemory?`: `number` ; `hardwareConcurrency?`: `number` ; `connection?`: { `saveData?`: `boolean` ; `addEventListener?`: (`event`: `string`, `handler`: () => `void`) => `void` ; `removeEventListener?`: (`event`: `string`, `handler`: () => `void`) => `void`  } ; `mozConnection?`: { `saveData?`: `boolean`  } ; `webkitConnection?`: { `saveData?`: `boolean`  }  } & { `[key: string]`: `any`;  }
