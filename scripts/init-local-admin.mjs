import fs from 'node:fs';
import crypto from 'node:crypto';
if(fs.existsSync('.dev.vars')){console.log('已存在 .dev.vars，保留现有配置。');process.exit(0);}
fs.writeFileSync('.dev.vars',`ADMIN_SETUP_TOKEN=${crypto.randomBytes(24).toString('hex')}\n`);
console.log('已生成本机 .dev.vars；首次管理员初始化口令保存在该文件中。请勿上传或分享该文件。');
