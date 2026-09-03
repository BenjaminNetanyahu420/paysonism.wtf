# Windows 98 cursor assets

These cursors come from the public-domain **Windows 98 Cursors** collection by
BooTeresa1006:

- Source: https://www.rw-designer.com/cursor-set/win98-bt1k6
- Download: https://www.rw-designer.com/cursor-downloadset/win98-bt1k6.zip
- Retrieved: 2026-09-02
- License: Released to Public Domain

The local filenames describe their CSS roles. They map to the source archive as
follows:

| Local file | Source file | Role |
| --- | --- | --- |
| `arrow.cur` | `arrow_d.cur` | Normal select |
| `hand.cur` | `hand-m.cur` | Link select |
| `text.cur` | `beam_d.cur` | Text select |
| `progress.cur` | `wait_d.cur` | Working in background |
| `busy.cur` | `busy_d.cur` | Busy |
| `help.cur` | `help_d.cur` | Help select |
| `unavailable.cur` | `no_r.cur` | Unavailable |
| `crosshair.cur` | `cross_d.cur` | Precision select |
| `move.cur` | `move_d.cur` | Move |
| `resize-nesw.cur` | `size1_r.cur` | Diagonal resize `/` |
| `resize-nwse.cur` | `size2_r.cur` | Diagonal resize `\` |
| `resize-ew.cur` | `size3_r.cur` | Horizontal resize |
| `resize-ns.cur` | `size4_r.cur` | Vertical resize |
| `up-arrow.cur` | `up_r.cur` | Alternate select |

The `_d` files are pixel-faithful reconstructions of the Windows defaults. The
remaining files are original Windows 98 cursor-folder variants included in the
same public-domain collection.

Windows rendered the original monochrome text cursor with an XOR operation so
it inverted the pixels underneath it. Web browsers do not reproduce that XOR
operation and rendered the cursor fully transparent. `text.cur` therefore keeps
the source cursor's exact 32×32 mask and 15×16 hotspot, but stores its visible
pixels in a browser-compatible 32-bit monochrome CUR image.
