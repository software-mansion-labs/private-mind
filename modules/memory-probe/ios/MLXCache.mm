#include <TargetConditionals.h>

// Hands the Metal buffers MLX keeps cached after a model unloads back to iOS; the simulator has no MLX, so there it does nothing.

#if TARGET_OS_SIMULATOR
extern "C" void pm_mlx_release_cache() {}
#else
namespace mlx::core {
void clear_cache();
}

extern "C" void pm_mlx_release_cache() { mlx::core::clear_cache(); }
#endif
