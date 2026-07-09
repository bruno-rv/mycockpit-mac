/**
 * @glaze/core/ipc compat — type-only module.
 *
 * Only `NativeThemeInfo` is actually constructed/consumed at runtime (by
 * main/handlers/native.ts and the settings theme UI), so it gets the real
 * shape from the SDK's `ipc/native-api.d.ts`. Everything else here is
 * referenced only as inert type annotations (dialog/menu/permissions surfaces
 * the app never calls), so they stay `any` per PORT_PLAN 1.3.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface NativeThemeInfo {
  shouldUseDarkColors: boolean;
  themeSource: "system" | "light" | "dark";
  accentColor?: string;
  shouldUseHighContrastColors?: boolean;
  shouldUseDarkColorsForSystemIntegratedUI?: boolean;
  shouldUseInvertedColorScheme?: boolean;
  inForcedColorsMode?: boolean;
  prefersReducedTransparency?: boolean;
}
export type OpenDialogOptions = any;
export type OpenDialogResult = any;
export type SaveDialogOptions = any;
export type SaveDialogResult = any;
export type MessageBoxOptions = any;
export type MessageBoxResult = any;
export type MediaAccessType = any;
export type AskForMediaAccessType = any;
export type PermissionStatus = any;
export type PermissionDiagnostic = any;
export type MenuItemConstructorOptions = any;
export type PopupOptions = any;
export type PopupResult = any;
export type DatePickerOptions = any;
export type DatePickerResult = any;
export type LocationPosition = any;
export type LocationPositionOptions = any;
export type SystemPreferencesAuthorizationType = any;
export type SystemPreferencesNotificationCallback = any;
export type SystemPreferencesNotificationPayload = any;
export type SystemPreferencesPreferredScrollerStyle = any;
