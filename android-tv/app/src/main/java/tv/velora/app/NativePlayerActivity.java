package tv.velora.app;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

public class NativePlayerActivity extends Activity {
    private ExoPlayer player;
    private PlayerView playerView;
    private TextView statusView;
    private String streamUrl;
    private String title;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );

        streamUrl = getIntent().getStringExtra("streamUrl");
        title = getIntent().getStringExtra("title");
        if (title == null || title.isBlank()) title = "VELORA Live";

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        playerView = new PlayerView(this);
        playerView.setBackgroundColor(Color.BLACK);
        playerView.setUseController(true);
        playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING);
        playerView.setKeepScreenOn(true);
        root.addView(playerView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        statusView = new TextView(this);
        statusView.setTextColor(Color.WHITE);
        statusView.setTextSize(18f);
        statusView.setBackgroundColor(0xAA080A10);
        statusView.setPadding(24, 16, 24, 16);
        statusView.setText("VELORA • " + title + "\nUsing native compatibility player…");
        FrameLayout.LayoutParams statusParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        statusParams.gravity = android.view.Gravity.TOP;
        root.addView(statusView, statusParams);

        setContentView(root);

        if (streamUrl == null || streamUrl.isBlank()) {
            showError("No stream URL was supplied.");
            return;
        }

        player = new ExoPlayer.Builder(this).build();
        playerView.setPlayer(player);
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_READY) {
                    statusView.setText("VELORA • " + title);
                    statusView.postDelayed(() -> statusView.setVisibility(View.GONE), 2200);
                } else if (playbackState == Player.STATE_BUFFERING) {
                    statusView.setVisibility(View.VISIBLE);
                    statusView.setText("VELORA • " + title + "\nLoading compatible player…");
                }
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                showError("This source still cannot be decoded on this device.");
            }
        });

        MediaItem item = new MediaItem.Builder()
            .setUri(Uri.parse(streamUrl))
            .setMediaId(title)
            .build();
        player.setMediaItem(item);
        player.prepare();
        player.play();
    }

    private void showError(String message) {
        statusView.setVisibility(View.VISIBLE);
        statusView.setText("VELORA • " + title + "\n" + message + "\nPress Back to choose another channel.");
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            finish();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) player.pause();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (player != null) player.play();
    }

    @Override
    protected void onDestroy() {
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
