# koishi-plugin-maimai-player-queue

[![npm](https://img.shields.io/npm/v/koishi-plugin-maimai-player-queue?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-maimai-player-queue)

用于记录并让玩家自发更新当前排卡数量的插件，目前自用，需要具体使用方法可联系我

## 使用指南
constant 为需要使用该插件的列表，平台取决于你使用的协议（一般 QQ 为 onebot），机器人 id 可使用 Koishi 官方插件 inspect 查看，群号同理（详见 https://koishi.chat/zh-CN/manual/usage/platform.html#%E8%8E%B7%E5%8F%96%E8%B4%A6%E5%8F%B7%E4%BF%A1%E6%81%AF）

## 默认命令
`j`: 查看当前排卡数量

`j+<数字>`: 当前排卡数量加数字

`j-<数字>`: 当前排卡数量减数字

`j=<数字>`: 设置排卡数量为数字

