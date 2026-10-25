# Typst 侧栏目录可行性

## 结论与当前范围

优先从已发布 PDF 的 outline 读取目录是可行的，无需改变编译协议或重新发布旧快照。本次只上线 Markdown 侧栏；Typst 保持连续 PDF 与现有文内链接导航，目录缺失不会阻止阅读，不从视觉文字猜测标题。

## 实测与 API

使用项目的 Typst 编译器构建两页示例（一级中文标题「第一章」，第二页二级标题「Second section」），再由项目 PDF.js 读取 `getOutline()`。实测得到嵌套标题和 `XYZ` 目标：第一页及第二页均有坐标 `x=40.494938, y=366.35547`，可通过 `getPageIndex(ref)` 把目标页引用解析成页序号。

[Typst heading 官方文档](https://typst.app/docs/reference/model/heading/) 描述 `bookmarked` 与 `outlined` 的控制。PDF.js 的 [PDFDocumentProxy API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html) 提供 `getOutline()`、`getDestination()`、`getPageIndex()`；项目安装包的 `types/src/display/api.d.ts` 也包含对应签名。读取 PDF 可以直接使用发布快照，且其坐标与实际排版对应；单独运行 `typst query` 则需额外保存版本一致的编译元数据，当前没有必要。

## 后续实施范围和限制

- 提取 outline 树，只接纳可解析的文内目标。没有 outline、作者禁用书签或只有无效目标时显示「暂无目录」，保留正常阅读；不执行外部 action、脚本或不可信 URL。
- 先解析命名或显式 destination，再解析页面引用。当前 `PdfReader.goTo` 只滚到页顶，完整支持必须利用该页的 viewport 将 PDF 坐标转为缩放后的页面内位置，并处理 `XYZ`、`FitH`、`Fit` 等目标的区别。
- 响应容器宽度与页面旋转，等待目标页布局就绪再定位；正文页面按需渲染，目录不能依赖 canvas 已经可见。
- 当前章节高亮需比较目录目标的实际页内位置。多栏排版、多个标题共用位置、无书签标题的缺失都需要明确规则；纯 PDF 文字没有可靠的 Markdown 层级，不能保证推断一致。
- 后续 PR 应覆盖有目录、无目录、嵌套和命名目标、无效引用、旋转/缩放、手机与键盘交互。保持现有 PDF 注释链接和连续阅读。
