> [!slack]+ Message from Alex Mittell
> **Time:** 7:47 PM
> Hey all, I've been annoyed for a while by trying to copy and paste Slack conversations into Obsidian 'nicely' so I knocked up a quick plug-in to make it easier. Does anyone know if / how I can get this added to the internal [[Notes/Lexicon/Stripe]] Obsidian plug-in repo?BTW you can grab it [here](https://github.com/amittell/obsidian-slack-formatter) if you want to try it, feedback and suggestions welcome this version is pretty rough and ready! :bufo-cowboy: [ ![IMG_5205.png](https://files.slack.com/files-tmb/T0181S17H6Z-F08BS9PP539-ca5b017000/img_5205_720.png) ](https://files.slack.com/files-pri/T0181S17H6Z-F08BS9PP539/img_5205.png) [](https://files.slack.com/files-pri/T0181S17H6Z-F08BS9PP539/download/img_5205.png?origin_team=E0181S17H6Z) [ ![IMG_3606.png](https://files.slack.com/files-tmb/T0181S17H6Z-F08C072EZK8-ac7a0cbdc5/img_3606_720.png) ](https://files.slack.com/files-pri/T0181S17H6Z-F08C072EZK8/img_3606.png) [](https://files.slack.com/files-pri/T0181S17H6Z-F08C072EZK8/download/img_3606.png?origin_team=E0181S17H6Z) [ ![IMG_8424.png](https://files.slack.com/files-tmb/T0181S17H6Z-F08BS9Q78RM-064de9aca6/img_8424_720.png) ](https://files.slack.com/files-pri/T0181S17H6Z-F08BS9Q78RM/img_8424.png) [](https://files.slack.com/files-pri/T0181S17H6Z-F08BS9Q78RM/download/img_8424.png?origin_team=E0181S17H6Z) [ ![IMG_3729.png](https://files.slack.com/files-tmb/T0181S17H6Z-F08C6RCG6HG-f8200610bb/img_3729_720.png) ](https://files.slack.com/files-pri/T0181S17H6Z-F08C6RCG6HG/img_3729.png) [](https://files.slack.com/files-pri/T0181S17H6Z-F08C6RCG6HG/download/img_3729.png?origin_team=E0181S17H6Z) amittell/obsidian-slack-formatter 1 minutes ago :so-beautiful:27:pika-aww:5

> [!slack]+ Message from Phillip Edgington
> **Time:** 8:01 PM
> you can make a PR here [https://git.corp.stripe.com/stripe-private-oss-forks/obsidian-plugins](https://git.corp.stripe.com/stripe-private-oss-forks/obsidian-plugins) and tag obsidian-reviewers for a review :bufo-ty:1

> [!slack]+ Message from Alex Mittell
> **Time:** 9:02 PM
> Thanks [@phillipedgington](https://stripe.slack.com/team/UL85BJW1W). I already found a bug with DM threads. I'l make s PR when I've fixed that. :bufo-lol-cry:

> [!slack]+ Message from Clement Miao
> **Time:** 8:25 AM
> this is AMAZING omg [8:26](https://stripe.slack.com/archives/C039S5CGKEJ/p1738934765553959?thread_ts=1738889253.251969&cid=C039S5CGKEJ) even if a bit buggy, this is going to be great

> [!slack]+ Message from Trajan McGill
> **Time:** 9:18 AM
> Yeah, this is going to be fantastic. [9:18](https://stripe.slack.com/archives/C039S5CGKEJ/p1738937929874099?thread_ts=1738889253.251969&cid=C039S5CGKEJ) So, first attempt was copying and pasting this very thread, and looks good, but it doesn't seem to detect where all the messages start and end. I get one big message containing the first three messages. [9:23](https://stripe.slack.com/archives/C039S5CGKEJ/p1738938227881789?thread_ts=1738889253.251969&cid=C039S5CGKEJ) Curious how the clipboard works on Slack copies; are there image objects along with the text, where eventually we could get pasted embedded images to just paste right in there, too? :bufo-thinking:1

> [!slack]+ Message from David Brownman
> **Time:** 1:31 PM
> [@alexm](https://stripe.slack.com/team/U07JC6P29UM) [@phillipedgington](https://stripe.slack.com/team/UL85BJW1W) FYI our rule (so far) is that we can use stripe-employee developed plugins straight from the "store", so i'm not sure you need the `private-oss-forks` PR if you don't want it :nice5:1 [1:31](https://stripe.slack.com/archives/C039S5CGKEJ/p1738953082490149?thread_ts=1738889253.251969&cid=C039S5CGKEJ) either way, seriously cool plugin! :bufo-ty:1

> [!slack]+ Message from Phillip Edgington
> **Time:** 1:31 PM
> oh interesting [1:31](https://stripe.slack.com/archives/C039S5CGKEJ/p1738953107321319?thread_ts=1738889253.251969&cid=C039S5CGKEJ) nice

> [!slack]+ Message from Alex Mittell
> **Time:** 10:52 PM
> I've updated the pluggin to handle DM conversation imports. Need to run a whole bunch of other slack copy and pastes through it I'm sure there are more cases I haven't accounted for, what you get in a raw copy and paste is limited but might be able to preserve the images that come over in it. The intercept cmd+V is currently non-functional I know about that one. :bufoyes: 🙏1

> [!slack]+ Message from Trajan McGill
> **Time:** 8:39 AM
> Hi [@alexm](https://stripe.slack.com/team/U07JC6P29UM), thanks for your work on this! Having installed the latest version (0.0.6), I'm having a bit of trouble making it paste as expected. I tried selecting all the messages in one entire thread in Slack, copying, and then using Cmd-shift-V to paste into Obsidian, and got nothing whatsoever as output. Hitting just Cmd-V does paste the usual badly formatted stuff, so I know it's in the clipboard. Then I tried doing the same with this very thread, and found that it did paste, but only about the last half of the thread. Any thoughts?

---

## Debug Information

### Processing Steps
- Detected format: standard
- Parsed 9 messages (intelligent)

### Unparsed Content

*All content was successfully parsed*