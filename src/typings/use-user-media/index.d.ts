declare module "use-user-media" {
    function useUserMedia(constraints: MediaStreamConstraints): [string, MediaStream]
}