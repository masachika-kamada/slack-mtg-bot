const { App } = require('@slack/bolt');
const chrono = require('chrono-node');
const schedule = require('node-schedule');
const moment = require('moment-timezone');

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});

let meetingDate = null;
let meetingChannel = null;

app.message(async ({ message, say }) => {
  const meetingPattern = /(\d{1,2}\/\d{1,2} \d{1,2}:\d{2})/;
  const match = message.text.match(meetingPattern);

  if (match) {
    const dateString = match[1];
    // 日本時間に合わせるために9h引く
    meetingDate = moment.tz(chrono.parseDate(dateString).toISOString(), 'Asia/Tokyo').subtract(9, 'hours');
    meetingChannel = message.channel;
    const formattedDate = meetingDate.tz('Asia/Tokyo').format('M月D日（ddd） HH:mm');
    await say(`次のMTGを ${formattedDate} に設定しました。`);

    const attendanceCheckReminderTime = new Date(meetingDate.clone().subtract(4, 'hours').tz('Asia/Tokyo').format());
    const meetingStartTime = new Date(meetingDate.clone().subtract(2, 'minutes').tz('Asia/Tokyo').format());
    console.log("現在時刻:", moment().tz('Asia/Tokyo').format());
    console.log("出席確認リマインダー予定時刻:", moment(attendanceCheckReminderTime).tz('Asia/Tokyo').format());
    console.log("リマインダー予定時刻:", moment(meetingStartTime).tz('Asia/Tokyo').format());

    schedule.scheduleJob(attendanceCheckReminderTime, async () => {
      console.log(`出席確認リマインダー実行時刻: ${new Date()}`);
      const attendanceCheckMessage = await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: meetingChannel,
        text: `<!channel>\n本日 ${meetingDate.format('HH:mm')} からMTGがあります。出席確認のスタンプを押してください :attend: :late: :absent:`,
      });

      const messageTimestamp = attendanceCheckMessage.ts;
      await app.client.reactions.add({
        token: process.env.SLACK_BOT_TOKEN,
        channel: meetingChannel,
        name: 'x',
        timestamp: messageTimestamp,
      });
    });

    schedule.scheduleJob(meetingStartTime, async () => {
      console.log(`MTG情報リマインダー実行時刻: ${new Date()}`);
      const meetingStartMessage = `
      <!channel>\nMTGを開始します。\n・Zoomリンク：${process.env.ZOOM_LINK}\n・Googleドライブ：${process.env.GOOGLE_DRIVE_LINK}\n・スプレッドシート：${process.env.SPREADSHEET_LINK}`;
      await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: meetingChannel,
        text: meetingStartMessage,
      });
    });
  }
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();
