package id.my.temancode.jagawarga

import android.content.Intent
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    /**
     * Intent dari widget membawa data URI (mis. `jagawarga:///panic/confirm?type=fire`).
     * go_router tidak boleh mem-parse URI itu sebagai lokasi awal, jadi kita
     * memaksa route awal `/`; plugin home_widget tetap membaca intent aslinya.
     */
    override fun getInitialRoute(): String =
        if (intent?.data != null) "/" else super.getInitialRoute() ?: "/"

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}
