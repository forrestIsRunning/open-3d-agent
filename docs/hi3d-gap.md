# Capability gap vs a Hi3D-class desktop

Hi3D ships ten “quick starts”. This lab implements the **mesh + version** loop (generate, restyle, scale, compose). It does not ship animation, print packing, or video.

| # | Quick start | This lab | Test |
|---|---|---|---|
| 1 | Animate character interactions | **No.** Still GLBs only. | `unsupported` |
| 2 | Build a virtual scene | **Partial.** Headless `lab-plaza.py` scales assets onto a walkable ring. No VR locomotion. | `blender-plaza` |
| 3 | Printable miniature | **No.** | `unsupported` |
| 4 | Explore layout options | **No** (one plaza, not N options). | `unsupported` |
| 5 | Unify asset styles | **Partial.** Same-family image-edit → new GLB (`husky · v2`). Not a shared material library. | `edit` |
| 6 | Scene demo video | **No.** Stage capture stills only. | `unsupported` |
| 7 | Fill holes | **Yes.** Headless Blender `mesh.fill_holes`. | `blender-repair` |
| 8 | Repair textures | **Partial.** Same as 5 (re-texture via Tripo), not UV-seam surgery. | `edit` |
| 9 | Fix skinning weights | **No.** No skeleton editor. | `unsupported` |
| 10 | Split + connectors | **No.** | `unsupported` |

Host always owns Tripo / Blender. Codex never launches `Blender.app`.

## Test prompts (English)

1. `Create a short story scene with these characters, coordinating their actions, positions, facing directions, and timing.` → unsupported  
2. `Build a game or VR environment using these assets, matching their relative scales and organizing them into a coherent, navigable space.` → plaza  
3. `Assemble these assets into a themed miniature world … optimize its structure for 3D printing.` → unsupported  
4. `Create multiple layout options for this space … present them for comparison.` → unsupported  
5. `Unify textures, materials, and colors across these assets while preserving each asset’s distinctive features.` → edit  
6. `Create a complete demo video of this scene, coordinating lighting, camera movement, animation, and pacing.` → unsupported  
7. `Find and fill unintended holes in this model while preserving its overall shape and intentional openings.` → repair  
8. `Check this model’s textures and fix missing textures, distortion, and visible seams while preserving its intended appearance.` → edit  
9. `Check and correct this character’s skinning weights … preserving the existing skeleton.` → unsupported  
10. `Split this model into parts and add matching connectors for assembly …` → unsupported  

Live mesh checks we already ran: `generate a Siberian husky` → `change the fur to golden-red` → `lab-husky_2.glb`.
