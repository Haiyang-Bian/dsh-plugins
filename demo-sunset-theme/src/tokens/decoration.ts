/** Separate image values: host semantic color tokens must remain valid colors. */
export const auroraDecoration = {
  canvas: `radial-gradient(ellipse at 0% 0%, rgba(139, 200, 227, .48), transparent 52%),
    radial-gradient(ellipse at 100% 18%, rgba(180, 166, 222, .32), transparent 48%),
    radial-gradient(ellipse at 72% 100%, rgba(142, 206, 205, .28), transparent 48%),
    linear-gradient(125deg, #f0f8fc, #f5f3fb 48%, #eff8f7)`,
  sidebar: `radial-gradient(ellipse at 15% 8%, rgba(151, 210, 231, .6), transparent 58%),
    radial-gradient(ellipse at 90% 88%, rgba(178, 165, 218, .42), transparent 60%),
    linear-gradient(155deg, #e0edf9, #e3f3f2 52%, #ece7f6)`,
} as const

export const sageDecoration = {
  canvas: `repeating-linear-gradient(0deg, rgba(67, 103, 77, .018) 0px 1px, transparent 1px 4px),
    repeating-linear-gradient(90deg, rgba(67, 103, 77, .012) 0px 1px, transparent 1px 5px),
    radial-gradient(ellipse at 3% 0%, rgba(166, 202, 170, .44), transparent 52%),
    radial-gradient(ellipse at 100% 12%, rgba(232, 213, 164, .38), transparent 48%),
    linear-gradient(135deg, #f0f7ef, #f8f6ed 52%, #edf5ef)`,
  sidebar: `repeating-linear-gradient(135deg, rgba(76, 112, 84, .055) 0px 1px, transparent 1px 18px),
    radial-gradient(ellipse at 5% 0%, rgba(153, 193, 158, .48), transparent 62%),
    linear-gradient(155deg, #e0eddf, #edf1de 52%, #e1efe7)`,
} as const
