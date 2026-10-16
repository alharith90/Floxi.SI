#!/bin/bash
set -euo pipefail
cd /workspace/Floxi.SI
export XDG_DATA_HOME=/workspace/.local/share
export XDG_CACHE_HOME=/workspace/.cache
export XDG_STATE_HOME=/workspace/.local/state
bash /workspace/.postgres/start.sh
# Refuse duplicate launches instead of silently choosing another frontend port.
node --input-type=module <<'JS'
import {createServer} from 'node:net';
for(const port of [3001,5173]){
 const server=createServer();
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',resolve);});await new Promise(resolve=>server.close(resolve));}
 catch{console.error(`Port ${port} is occupied. Reuse the existing Floxi services or stop the task-owned launch before starting again.`);process.exit(1);}
}
JS
exec pnpm dev
