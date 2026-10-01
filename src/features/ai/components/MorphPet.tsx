/* =============================================================================
   MorphPet.tsx —— 带"梯形遮挡片"换形态的宠物
   ---------------------------------------------------------------------------
   把 Pet 包一层：body 一变，梯形遮挡片从右侧远处扫过，
   在完全遮住的那一瞬偷换形态，然后从左侧离开、露出新形态。

   为什么要单独成文件：
     它同时被 ChapterRunner（开场页/变形页）和 FeedGame / ImbalanceGame 用。
     如果放在 ChapterRunner 里，会变成 ChapterRunner → FeedGame → ChapterRunner 的循环依赖。
   ========================================================================== */

import { Pet } from '@/features/ai/pet/Pet'
import { PetMorph } from '@/features/ai/components/PetMorph'
import type { BodyKind, Mood } from '@/features/ai/pet/petState'

interface MorphPetProps {
  body: BodyKind
  mood?: Mood
  spots?: number
  size?: number
  still?: boolean
  /** 吃到东西时的弹性动画计数 */
  bounce?: number
  /** 眼睛盯着看的坐标 */
  lookAt?: { x: number; y: number } | null
}

export function MorphPet({ body, ...rest }: MorphPetProps) {
  return (
    <PetMorph
      morphKey={body}
      /* ★ 用 PetMorph 回传的"当前该显示的形态"，不能闭包外层的 body。
         否则新形态会立刻出现，遮挡片就只剩装饰作用，偷换就没意义了。 */
      render={(shown) => <Pet body={shown as BodyKind} {...rest} />}
    />
  )
}
