import { Context, Schema, h } from 'koishi';

export const name = 'maimai-player-queue';

interface GroupList {
  enabled: boolean,
  note: string,
  platform: string,
  self_id: string,
  group_id: string,
}

export interface Config {
  maimai_count: number,
  constant: Array<GroupList>,
}

export const Config: Schema<Config> = Schema.object({
  maimai_count: Schema.number().description("舞萌数量").default(1).min(1),
  constant: Schema.array(Schema.object({
    enabled: Schema.boolean().description("是否启用").default(true),
    note: Schema.string().description("备注"),
    platform: Schema.string().description("平台").required(),
    self_id: Schema.string().description("机器人id").required(),
    group_id: Schema.string().description("群号").required(),
  })),
});

var queues: number = 0;
var updated: boolean = false;
var updated_time: number = 0; // 时间戳

function timeDifference(x: number): string {
  // 获取当前时间戳（单位为秒）
  const t = Math.floor(Date.now() / 1000);

  // 计算时间差，单位为秒
  const diff = t - x;

  // 将秒转换为分钟
  const minutes = Math.ceil(diff / 60);

  // 计算小时和剩余分钟
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  // 构建返回字符串
  if (hours > 0) {
      return `${hours} 小时 ${remainingMinutes} 分钟`;
  } else {
      return `${minutes} 分钟`;
  }
}

export function apply(ctx: Context, config: Config) {
  ctx.command("j").action((_) => {
    let exist = false;
    for (let i = 0; i < config.constant.length; i++){
      if (config.constant[i].enabled && config.constant[i].platform === _.session.platform && config.constant[i].self_id === _.session.selfId && config.constant[i].group_id === _.session.channelId){
        exist = true;
        break;
      }
    }

    if (!exist) return;

    let message = `${h("at", { id: _.session.userId })}\n==================\n`;
    if (!updated){
      message += "当前还没有人更新过排卡数据";
      return message;
    }
    message += `${timeDifference(updated_time)}前 ${queues} 卡，机均 ${Math.floor(queues / config.maimai_count)} 卡\n==================\n`;

    return message;
  });

  ctx.on("message", async (session) => {
    let exist = false;
    for (let i = 0; i < config.constant.length; i++){
      if (config.constant[i].enabled && config.constant[i].platform === session.platform && config.constant[i].self_id === session.selfId && config.constant[i].group_id === session.channelId){
        exist = true;
        break;
      }
    }

    if (!exist) return;

    // 判断消息格式是否为 j<操作符+-=><数字>
    const message = session.content;
    const regex = /j[+-=]\d+/;
    if (!regex.test(message)) return;

    // 获取操作符和数字
    const operator = message[1];
    const number = parseInt(message.slice(2));

    if (number < 0) return;

    // 更新排卡数据
    if (operator === "+"){
      queues += number;
    } else if (operator === "-"){
      queues -= number;
    } else if (operator === "="){
      queues = number;
    }

    updated = true;
    updated_time = Math.floor(Date.now() / 1000);

    // 返回消息
    let result = `${h("at", { id: session.userId })}\n==================\n已更新排卡数据，当前 ${queues} 卡，机均 ${Math.floor(queues / config.maimai_count)} 卡`;
    await session.send(result);
  });

  ctx.setInterval(() => {
    // 每分钟检查一次是否已经是第二天了，如果是就将 queues 设置为 0 并将 updated 设置为 false
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0){
      queues = 0;
      updated = false;
    }
  }, 1000 * 60);
}
