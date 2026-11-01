package expo.modules.tmdbdns

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TmdbDnsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("YummyTmdbDns")

    Function("getEnabled") { TmdbDnsNetwork.enabled }

    AsyncFunction("setEnabled") { enabled: Boolean ->
      TmdbDnsNetwork.setEnabled(enabled)
    }
  }
}
