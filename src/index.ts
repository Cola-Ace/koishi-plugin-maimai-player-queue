import { Context, Schema, h } from 'koishi';
import { } from 'koishi-plugin-adapter-onebot';

export const name = 'maimai-player-queue';

interface GroupList {
  enabled: boolean,
  note: string,
  platform: string,
  self_id: string,
  group_id: string,
}

interface SyncGroupList {
  enabled: boolean,
  note: string,
  platform: string,
  self_id: string,
  group_id: string,
  prefix_command: string,
}

export interface Config {
  maimai_count: number,
  max_cards: number,
  constant: Array<GroupList>,
  sync_group: Array<SyncGroupList>,
}

export const Config: Schema<Config> = Schema.object({
  maimai_count: Schema.number().description("舞萌数量").default(1).min(1),
  max_cards: Schema.number().description("最大排卡数").default(30).min(1),
  constant: Schema.array(Schema.object({
    enabled: Schema.boolean().description("是否启用").default(true),
    note: Schema.string().description("备注"),
    platform: Schema.string().description("平台").required(),
    self_id: Schema.string().description("机器人id").required(),
    group_id: Schema.string().description("群号").required(),
  })),
  sync_group: Schema.array(Schema.object({
    enabled: Schema.boolean().description("是否启用").default(true),
    note: Schema.string().description("备注"),
    platform: Schema.string().description("平台").required(),
    self_id: Schema.string().description("机器人id").required(),
    group_id: Schema.string().description("群号").required(),
    prefix_command: Schema.string().description("前缀指令").default("j").required(),
  })).description("将排卡同步更新到其他群"),
});

var queues: number = 0;
var updated: boolean = false;
var updated_time: number = 0; // 时间戳
var updated_name = "";
var updated_id = "";

const note = "请在到达机厅后输入 j+1 来加卡，退勤时使用 j-1 来减卡，多人出勤可修改后方数字来一次性增加/减少多个卡数\n使用 j[数字] 可快速设置当前排卡数";

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

// 将时间戳（秒）转换为 HH:MM:SS 格式
function formatTime(x: number): string {
  const date = new Date(x * 1000);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function getAverageCards(queues: number, maimai_count: number): string {
  if (queues % maimai_count === 0) return queues.toString();
  return `${Math.floor(queues / maimai_count)}+`;
}

function changeCards(queues: number, update: number, operator: string): number {
  if (operator === "+") {
    return queues + update;
  } else if (operator === "-") {
    return queues - update;
  } else if (operator === "=") {
    return update;
  }
}

export function apply(ctx: Context, config: Config) {
  ctx.command("j").action((_) => {
    let exist = false;
    for (let i = 0; i < config.constant.length; i++) {
      if (config.constant[i].enabled && config.constant[i].platform === _.session.platform && config.constant[i].self_id === _.session.selfId && config.constant[i].group_id === _.session.channelId) {
        exist = true;
        break;
      }
    }

    if (!exist) return;

    let message = `${h("at", { id: _.session.userId })} 机厅数据如下:\n==================\n`;
    if (!updated) {
      message += `当前还没有人更新过排卡数据\n==================\n${note}`;
      return message;
    }
    message += `${timeDifference(updated_time)}前 ${queues} 卡，机均 ${getAverageCards(queues, config.maimai_count)} 卡\n==================\n`;
    message += `由 ${updated_name} (${updated_id}) 更新于 ${formatTime(updated_time)}\n${note}`;

    return message;
  });

  ctx.on("message", async (session) => {
    let exist = false;
    for (let i = 0; i < config.constant.length; i++) {
      if (config.constant[i].enabled && config.constant[i].platform === session.platform && config.constant[i].self_id === session.selfId && config.constant[i].group_id === session.channelId) {
        exist = true;
        break;
      }
    }

    if (!exist) return;

    // 判断消息格式是否为 j<操作符+-><数字>
    const message = session.content;
    const regex = /^j[+-]?(0|[1-9][0-9]*)$/i;
    if (!regex.test(message)) return;

    // 获取操作符和数字
    const operator = (message[1] === "+" || message[1] === "-") ? message[1] : "=";
    const update = parseInt(message.slice(operator === "=" ? 1 : 2));

    if (update < 0) {
      await session.send(`${h.at(session.userId)} 干什么！`);
      return;
    }

    // 更新排卡数据
    const temp = changeCards(queues, update, operator);
    if (temp < 0 || temp > config.max_cards) {
      await session.send(`${h.at(session.userId)} 干什么！`);
      return;
    }

    queues = temp;

    updated = true;
    updated_time = Math.floor(Date.now() / 1000);

    updated_id = session.userId;
    // 获取发送者信息
    if (session.platform === "onebot") {
      const sender = await session.onebot.getGroupMemberInfo(session.channelId, session.userId);
      updated_name = sender.card === "" ? sender.nickname : sender.card;
    } else {
      updated_name = session.event.user.name;
    }

    // 返回消息
    let result = `${h("at", { id: session.userId })} ${formatTime(updated_time)} 更新成功，当前 ${queues} 卡，机均 ${getAverageCards(queues, config.maimai_count)} 卡`;
    await session.send(result);

    // 同步更新到其他群
    for (let i = 0; i < config.sync_group.length; i++) {
      if (config.sync_group[i].enabled) {
        const prefix = config.sync_group[i].prefix_command;
        const message = `${prefix}${queues}`;

        const sync_bot = ctx.bots[`${config.sync_group[i].platform}:${config.sync_group[i].self_id}`];
        await sync_bot.sendMessage(config.sync_group[i].group_id, message);
      }
    }
  });

  ctx.setInterval(() => {
    // 每 50 秒检查一次是否已经是第二天了，如果是就将 queues 设置为 0 并将 updated 设置为 false
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      queues = 0;
      updated = false;
    }
  }, 1000 * 50);
}
