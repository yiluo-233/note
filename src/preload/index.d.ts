/** 窗口接口声明：让界面通过共享契约访问预加载桥接。 */
import type { AppApi } from '../../shared/api'

declare global {
  interface Window {
    api: AppApi
  }
}
