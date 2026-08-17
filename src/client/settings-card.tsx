/**
 * 「设置 → 插件」里的查看器配置卡片：显示插件信息 + 开启/关闭开关。
 */

import { setViewerEnabled, useViewerEnabled } from './store'
import css from './styles.module.css'

export interface SettingsCardProps {
  t: (key: string) => string
}

export function ViewerSettingsCard({ t }: SettingsCardProps) {
  const enabled = useViewerEnabled()
  return (
    <div className={css.settingsCard}>
      <div className={css.settingsRow}>
        <div className={css.settingsInfo}>
          <div className={css.settingsTitle}>{t('title')}</div>
          <div className={css.settingsDesc}>{t('settingsDesc')}</div>
        </div>
        <label className={css.switch}>
          <input
            type="checkbox"
            className={css.switchInput}
            checked={enabled}
            onChange={(event) => setViewerEnabled(event.target.checked)}
          />
          <span className={css.switchLabel} data-on={enabled ? 'true' : 'false'}>
            {enabled ? t('enabled') : t('disabled')}
          </span>
        </label>
      </div>
    </div>
  )
}
