#include <TargetConditionals.h>

#if TARGET_OS_SIMULATOR
extern "C" void pm_mlx_release_cache() {}
#else
namespace mlx::core {
void clear_cache();
}

extern "C" void pm_mlx_release_cache() { mlx::core::clear_cache(); }
#endif
