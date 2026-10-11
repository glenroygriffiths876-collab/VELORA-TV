# VELORA maintenance requirements

Preserve TVJ as the first Live TV selection per app session. Explicit user selections must survive background discovery, catalogue refresh, failures and retries. CH+/CH− must use decoded-video-confirmed channels only; neither a successful HTTP response nor a server health label proves video playback.

Run `npm run check` and `npm test` before publishing changes. Keep the live-reliability gate in the Pages publishing workflow. Add regression coverage for changed scanner/player behavior. Test delayed video, cancellation and recovery, not only instant-success mocks. Record any device playback verification limits honestly.

Keep index.html and sw.js asset versions aligned; update the service-worker cache version for changed shell assets. Preserve the existing Pages/Railway deployment topology. Verify both deployment outcomes after changes affecting both components. Do not declare a channel count or device compatibility without observing it.
