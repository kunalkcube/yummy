package expo.modules.yummydownloads

import android.app.Activity
import android.os.Bundle
import android.os.Build
import android.view.WindowManager
import android.widget.TextView

class DownloadTestActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    if (Build.VERSION.SDK_INT >= 27) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }
    setContentView(TextView(this).apply {
      text = "Yummy offline download verification"
      setTextColor(android.graphics.Color.WHITE)
      setBackgroundColor(android.graphics.Color.BLACK)
      gravity = android.view.Gravity.CENTER
    })
  }
}
