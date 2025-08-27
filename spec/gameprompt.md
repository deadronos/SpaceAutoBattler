inspect /spec/ui.html /spec/styles/ui.css  

design a new codebase from scratch targeting deadronos/issue28 branch
potentially overwriting every /src /dist /scripts files 

we start from scratch every /src has been deleted

only use the ui html/css to guide how ui shall look

create scaffolding for a typescript project in /src
for a space/scifi themed autobattler (red vs blue teams of fleets)
ship classes fighter/corvette/frigate/destroyer/carrier (carrier could spawn fighters on cooldown limited to some number maybe 6 alive at once) ships have turrets shooting bullets

ships have differing number of turrets/health/armor/shield/shieldregen
and have a progression system earn xp and lvlup on dmg and kill (bullet ownerid must be tracked)
lvlup improves stats 

intent is to output to /dist a "spaceautobattler.html" with /dist/bundled.ts of all typescript inlined (and a bundle.css)
additonally output a "spaceautobattler_standalone.html" with all html/css/ts/svg assets inlined
use three.js renderer
configurables like sim boundaries, ship classes, attributes (health, armor, shield), turrets with cannons firing bullets), particle fx like engine glow/trails, shield hits, explosions could be configdriven 

configs could specify to procedurally generate fx/assets etc.
write all relevant configurables to /src/config files
unify types to a /src/types folder
use a seeded rng to deterministically run simulation, changable with seed ui button
use simple models eg placeholder svg extruded/transformed to meshes/models for start, (svg could provide more ship metadata later)

main.ts can be entrypoint and have loading state and start gameloop
gameloop can be 

simulatestep
rendererstep
repeat

fightingai/movementai/ship/turretlogic in simstep can be a gamemanager type module (decide what entitites intent to do)
simstep should also handle physics (decide what happens, update gamestate)

everything should be setup as childs/extensions of a gamestate object/type

fleets should be randomized to seeded rng per team, +add red/blue buttons can manually spawn ships

start button can start and pause sim, 

target everything for around 60 fps renderer step and 60 ticks per second simstep